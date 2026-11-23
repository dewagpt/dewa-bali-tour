import { handleApi } from "../_lib/api.js";

/** Semua request /api/* diarahkan ke satu handler. */
export async function onRequest(context) {
  return handleApi(context.request, context.env);
}