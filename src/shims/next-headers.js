import { requestContext } from "./context.js";

export function headers() {
  const store = requestContext.getStore();
  if (!store?.request) {
    throw new Error("headers() called outside of a request");
  }
  return store.request.headers;
}

export function cookies() {
  throw new Error("cookies() is not available on the Express API server");
}
