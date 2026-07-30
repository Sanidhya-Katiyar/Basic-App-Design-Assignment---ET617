import { Router } from "express";
import { getSession } from "./auth.js";
import { recordEvent } from "../track.js";
import { clientIp } from "../util.js";

export const router = Router();

// Accepts a batch of client-reported events. Works with both fetch() (JSON)
// and navigator.sendBeacon (which sends the body as text/plain on unload).
// Auth is optional here: pre-login events (e.g. viewing the login page) are
// still recorded, just with a null user.
router.post("/", (req, res) => {
  const session = getSession(req);
  const ip = clientIp(req);
  const ua = req.get("user-agent") || null;

  let payload = req.body;
  // sendBeacon lands as a string when content-type is text/plain.
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { payload = null; }
  }
  const events = Array.isArray(payload?.events) ? payload.events : Array.isArray(payload) ? payload : [];
  if (!events.length) return res.status(204).end();

  let stored = 0;
  for (const ev of events) {
    if (!ev || !ev.event_name) continue;
    recordEvent({
      client_ts: ev.client_ts || null,
      user_id: session?.user_id ?? null,
      session_id: session?.id ?? ev.session_id ?? null,
      component: ev.component || "System",
      event_name: ev.event_name,
      event_context: ev.event_context,
      description: ev.description, // usually undefined → server generates Moodle sentence
      origin: "web",
      ip,
      route: ev.route || null,
      target_type: ev.target_type || null,
      target_id: ev.target_id ?? null,
      // pass through fields the describe() helper understands, plus a meta blob
      title: ev.title, label: ev.label, module: ev.module, question: ev.question,
      at: ev.at, from: ev.from, rate: ev.rate, percent: ev.percent,
      score: ev.score, max_score: ev.max_score, attempt_id: ev.attempt_id,
      meta: ev.meta || null,
      user_agent: ua,
      viewport: ev.viewport || null,
    });
    stored++;
  }
  res.json({ stored });
});

export default router;
