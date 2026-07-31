import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "./auth.js";
import { recordEvent } from "../track.js";
import { clientIp } from "../util.js";

export const router = Router();

// Exports the clickstream as a CSV whose columns EXACTLY match the Moodle log
// report the instructor provided:
//   Time | Event context | Component | Event name | Description | Origin | IP address
router.get("/clickstream.csv", requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT ts, event_context, component, event_name, description, origin, ip
    FROM events ORDER BY id
  `).all();

  const header = ["Time", "Event context", "Component", "Event name", "Description", "Origin", "IP address"];
  const lines = [header.map(csv).join(",")];
  for (const r of rows) {
    lines.push([
      moodleTime(r.ts),
      r.event_context,
      r.component,
      r.event_name,
      r.description,
      r.origin,
      r.ip || "",
    ].map(csv).join(","));
  }
  const body = lines.join("\r\n");

  recordEvent({
    user_id: req.userId, session_id: req.session.id, component: "Logs",
    event_name: "Report exported", ip: clientIp(req), route: "/analytics",
    event_context: "Course: ET617 Educational App Design",
  });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="learntrace-clickstream.csv"');
  res.send(body);
});

// Also expose the raw superset as JSON, handy for the presentation / debugging.
router.get("/clickstream.json", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM events ORDER BY id").all();
  res.json({ count: rows.length, events: rows });
});

// Format ISO timestamp as Moodle's "D/MM/YY, HH:MM:SS" (e.g. 5/08/24, 02:57:25).
function moodleTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const day = d.getDate();
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  const yr = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${day}/${mon}/${yr}, ${hh}:${mm}:${ss}`;
}

function csv(v) {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default router;
