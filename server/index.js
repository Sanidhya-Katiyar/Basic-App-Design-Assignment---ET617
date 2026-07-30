import express from "express";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

import "./db.js"; // initialise DB + schema on boot
import { router as authRouter } from "./routes/auth.js";
import contentRouter from "./routes/content.js";
import eventsRouter from "./routes/events.js";
import analyticsRouter from "./routes/analytics.js";
import exportRouter from "./routes/export.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const app = express();

app.set("trust proxy", true);
app.use(cookieParser());

// JSON for normal requests; text/plain to catch navigator.sendBeacon payloads.
app.use(express.json({ limit: "1mb" }));
app.use(express.text({ type: ["text/plain", "application/csp-report"], limit: "1mb" }));

app.use("/api/auth", authRouter);
app.use("/api", contentRouter);
app.use("/api/events", eventsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/export", exportRouter);

app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// --- static assets ---------------------------------------------------------
// The bundled demo video lives in client/public/media and is copied into the
// build by Vite. In dev, Vite serves it; in prod we serve it from client/public
// (so it works even before a build) and the built SPA from dist/.
const publicDir = join(__dirname, "..", "client", "public");
app.use(express.static(publicDir));

const distDir = join(__dirname, "..", "dist");
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback: anything not under /api and not a real file → index.html
  app.get(/^\/(?!api\/).*/, (req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(join(distDir, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`LearnTrace server on http://localhost:${PORT}`);
  if (!existsSync(distDir)) {
    console.log("(dev mode: run the Vite client separately, or `npm run serve` for a single-process build)");
  }
});
