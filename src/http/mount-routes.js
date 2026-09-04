import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { requestContext } from "../shims/context.js";
import { createIncomingRequest } from "./incoming-request.js";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function toExpressPath(relativeFile) {
  const withoutRoute = relativeFile.replace(/\\/g, "/").replace(/\/route\.js$/, "");
  return `/api/${withoutRoute.replace(/\[(\.\.\.)?([^\]]+)\]/g, (_, rest, name) => (rest ? "*" : `:${name}`))}`;
}

async function walkRouteFiles(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkRouteFiles(full, base)));
      continue;
    }
    if (entry.name === "route.js") {
      files.push(path.relative(base, full));
    }
  }
  return files;
}

async function sendWebResponse(res, response) {
  res.status(response.status);
  const cookies = [];
  for (const [key, value] of response.headers.entries()) {
    if (key.toLowerCase() === "set-cookie") {
      cookies.push(value);
      continue;
    }
    res.setHeader(key, value);
  }
  if (cookies.length) res.setHeader("set-cookie", cookies);
  const buffer = Buffer.from(await response.arrayBuffer());
  res.send(buffer);
}

function wrap(handler) {
  return async (req, res, next) => {
    try {
      const request = createIncomingRequest(req);
      await requestContext.run({ request }, async () => {
        const response = await handler(request, { params: Promise.resolve(req.params) });
        if (!response) {
          res.status(204).end();
          return;
        }
        await sendWebResponse(res, response);
      });
    } catch (error) {
      next(error);
    }
  };
}

export async function mountApiRoutes(app, routesDir) {
  const files = await walkRouteFiles(routesDir);
  for (const relative of files) {
    if (relative.replace(/\\/g, "/").startsWith("auth/")) continue;
    const mod = await import(pathToFileURL(path.join(routesDir, relative)).href);
    const expressPath = toExpressPath(relative);
    for (const method of METHODS) {
      if (typeof mod[method] !== "function") continue;
      app[method.toLowerCase()](expressPath, wrap(mod[method]));
    }
  }
}
