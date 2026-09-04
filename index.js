import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./src/lib/auth.js";
import { prisma } from "./src/lib/prisma.js";
import { mountApiRoutes } from "./src/http/mount-routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8000);

function allowedOrigins() {
  return String(process.env.CLIENT_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  const allowed = allowedOrigins();
  if (allowed.includes(origin)) return true;
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
}

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, origin || true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.all("/api/auth/{*path}", toNodeHandler(auth));
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.send("ORVIX API");
});

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, database: "postgresql" });
  } catch (error) {
    console.error(error);
    res.status(503).json({ ok: false, database: "postgresql", error: "Database unavailable" });
  }
});

await mountApiRoutes(app, path.join(__dirname, "src/api"));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error" });
});

app.listen(port, async () => {
  try {
    await prisma.$connect();
    console.log("Connected to PostgreSQL");
  } catch (error) {
    console.error("PostgreSQL connection failed:", error.message);
  }
  console.log(`ORVIX API running on port ${port}`);
});
