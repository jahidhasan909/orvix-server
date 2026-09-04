export function createIncomingRequest(req) {
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http")
    .split(",")[0]
    .trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost")
    .split(",")[0]
    .trim();
  const url = `${proto}://${host}${req.originalUrl}`;
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
  }

  const method = String(req.method || "GET").toUpperCase();
  const init = { method, headers };
  if (!["GET", "HEAD"].includes(method)) {
    if (Buffer.isBuffer(req.body) || typeof req.body === "string") {
      init.body = req.body;
    } else if (req.body != null) {
      init.body = JSON.stringify(req.body);
      if (!headers.has("content-type")) headers.set("content-type", "application/json");
    }
  }

  const request = new Request(url, init);
  Object.defineProperty(request, "nextUrl", { value: new URL(url) });
  return request;
}
