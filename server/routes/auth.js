import { Router } from "express";
import { db } from "../db.js";
import { verifyPassword, newToken } from "../auth-util.js";
import { recordEvent } from "../track.js";
import { clientIp } from "../util.js";

export const router = Router();

const SESSION_COOKIE = "lt_session";

export function getSession(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const s = db.prepare("SELECT * FROM sessions WHERE id=?").get(token);
  if (!s) return null;
  db.prepare("UPDATE sessions SET last_seen=? WHERE id=?").run(new Date().toISOString(), token);
  return s;
}

export function requireAuth(req, res, next) {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: "Not authenticated" });
  req.session = s;
  req.userId = s.user_id;
  next();
}

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE username=?").get(String(username || "").trim().toLowerCase());
  if (!user || !verifyPassword(password || "", user.password_hash)) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  const token = newToken();
  const nowIso = new Date().toISOString();
  const ip = clientIp(req);
  db.prepare(
    "INSERT INTO sessions(id,user_id,created_at,last_seen,user_agent,ip) VALUES(?,?,?,?,?,?)"
  ).run(token, user.id, nowIso, nowIso, req.get("user-agent") || null, ip);

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });

  recordEvent({
    user_id: user.id, session_id: token, component: "System",
    event_name: "User logged in", ip, route: "/login",
    user_agent: req.get("user-agent") || null,
  });

  res.json({ user: publicUser(user), sessionId: token });
});

router.post("/logout", (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    const s = db.prepare("SELECT * FROM sessions WHERE id=?").get(token);
    if (s) {
      recordEvent({
        user_id: s.user_id, session_id: token, component: "System",
        event_name: "User logged out", ip: clientIp(req), route: "/login",
      });
      db.prepare("DELETE FROM sessions WHERE id=?").run(token);
    }
  }
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

router.get("/me", (req, res) => {
  const s = getSession(req);
  if (!s) return res.json({ user: null });
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(s.user_id);
  res.json({ user: user ? publicUser(user) : null, sessionId: s.id });
});

function publicUser(u) {
  return { id: u.id, username: u.username, name: u.name, role: u.role };
}
