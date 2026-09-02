const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { prisma } = require("./src/db");

const app = express();
const port = process.env.PORT || 8000;
const origin = process.env.CLIENT_ORIGIN || "http://localhost:3000";

app.use(
  cors({
    origin,
    credentials: true,
  })
);
app.use(express.json());

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

app.get("/api/ngos", async (_req, res) => {
  const items = await prisma.ngo.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true } } },
  });
  res.json({ items });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error" });
});

app.listen(port, async () => {
  try {
    await prisma.$connect();
    console.log("Connected to Supabase PostgreSQL");
  } catch (error) {
    console.error("PostgreSQL connection failed:", error.message);
  }
  console.log(`Server is running on port ${port}`);
});
