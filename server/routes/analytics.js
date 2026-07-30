import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "./auth.js";
import { recordEvent } from "../track.js";
import { clientIp } from "../util.js";

export const router = Router();

// Aggregate stats for the in-app analytics dashboard.
router.get("/summary", requireAuth, (req, res) => {
  const totals = db.prepare("SELECT COUNT(*) events, COUNT(DISTINCT user_id) users, COUNT(DISTINCT session_id) sessions FROM events").get();

  const byEvent = db.prepare(
    "SELECT event_name, COUNT(*) count FROM events GROUP BY event_name ORDER BY count DESC"
  ).all();

  const byComponent = db.prepare(
    "SELECT component, COUNT(*) count FROM events GROUP BY component ORDER BY count DESC"
  ).all();

  const perUser = db.prepare(`
    SELECT u.id, u.name, u.username, u.role,
           COUNT(e.id) events,
           SUM(CASE WHEN e.component='Media' THEN 1 ELSE 0 END) video_events,
           SUM(CASE WHEN e.component='Quiz' THEN 1 ELSE 0 END) quiz_events
    FROM users u LEFT JOIN events e ON e.user_id=u.id
    GROUP BY u.id ORDER BY events DESC
  `).all();

  // Quiz performance across all attempts.
  const quizScores = db.prepare(`
    SELECT a.id attempt_id, u.name learner, q.title quiz,
           a.score, a.max_score, a.submitted_at
    FROM attempts a JOIN users u ON u.id=a.user_id JOIN quizzes q ON q.id=a.quiz_id
    WHERE a.submitted_at IS NOT NULL
    ORDER BY a.submitted_at DESC
  `).all();

  // Video engagement: furthest progress milestone reached, per user.
  const videoProgress = db.prepare(`
    SELECT user_id, MAX(CAST(json_extract(meta,'$.percent') AS INTEGER)) max_percent
    FROM events WHERE event_name='Video progress' AND meta IS NOT NULL
    GROUP BY user_id
  `).all();

  // Recent activity feed.
  const recent = db.prepare(
    "SELECT ts, event_name, component, description FROM events ORDER BY id DESC LIMIT 25"
  ).all();

  const timeline = db.prepare(`
    SELECT substr(ts,1,13) hour, COUNT(*) count
    FROM events GROUP BY hour ORDER BY hour
  `).all();

  recordEvent({
    user_id: req.userId, session_id: req.session.id, component: "System",
    event_name: "Dashboard viewed", ip: clientIp(req), route: "/analytics",
  });

  res.json({ totals, byEvent, byComponent, perUser, quizScores, videoProgress, recent, timeline });
});

export default router;
