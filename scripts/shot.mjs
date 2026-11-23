#!/usr/bin/env node
/* Screenshot halaman via Chrome DevTools Protocol (tanpa dependensi npm) */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const [, , url, out, widthArg = "1440", themeArg = "light", modeArg = "full"] = process.argv;
const width = Number(widthArg);
const theme = themeArg;

const profile = fs.mkdtempSync("/tmp/dbt-cdp-");
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--window-size=1440,900",
    "about:blank",
  ],
  { stdio: "ignore" }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function httpJson(u) {
  const res = await fetch(u);
  return res.json();
}

async function waitForBrowser() {
  for (let i = 0; i < 80; i++) {
    try {
      const v = await httpJson(`http://127.0.0.1:${PORT}/json/version`);
      if (v.webSocketDebuggerUrl) return v;
    } catch { /* belum siap */ }
    await sleep(120);
  }
  throw new Error("Chrome tidak mau jalan");
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        (this.events.get(msg.method) || []).forEach((fn) => fn(msg.params));
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  once(method, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout ${method}`)), timeout);
      const list = this.events.get(method) || [];
      const fn = (p) => {
        clearTimeout(timer);
        this.events.set(method, list.filter((x) => x !== fn));
        resolve(p);
      };
      this.events.set(method, [...list, fn]);
    });
  }
}

(async () => {
  const version = await waitForBrowser();
  const target = await (
    await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })
  ).json();

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res);
    ws.addEventListener("error", rej);
  });
  const cdp = new CDP(ws);

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  // jangan biarkan beacon eksternal menggantung di lingkungan offline
  await cdp.send("Network.setBlockedURLs", { urls: ["*cloudflareinsights*", "*google*"] });
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 900,
    deviceScaleFactor: 2,
    mobile: width < 600,
  });
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: theme }],
  });

  await cdp.send("Page.navigate", { url });
  for (let i = 0; i < 60; i++) {
    await sleep(100);
    const { result } = await cdp.send("Runtime.evaluate", {
      expression: "document.readyState",
      returnByValue: true,
    });
    if (result.value === "complete" || result.value === "interactive") break;
  }
  await sleep(500);

  await cdp.send("Runtime.evaluate", {
    expression: `document.documentElement.dataset.theme = ${JSON.stringify(theme)};
      document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('in'));
      document.body.style.scrollBehavior='auto';`,
  });
  await sleep(900);

  const { result } = await cdp.send("Runtime.evaluate", {
    expression: `JSON.stringify({h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth})`,
    returnByValue: true,
  });
  const dims = JSON.parse(result.value);
  const height = modeArg === "full" ? Math.min(dims.h, 9000) : 900;

  const shot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  });

  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log(`${out}  ${dims.w}x${dims.h} (${theme})`);

  ws.close();
  chrome.kill("SIGKILL");
  fs.rmSync(profile, { recursive: true, force: true });
  process.exit(0);
})().catch((err) => {
  console.error("GAGAL:", err.message);
  chrome.kill("SIGKILL");
  process.exit(1);
});