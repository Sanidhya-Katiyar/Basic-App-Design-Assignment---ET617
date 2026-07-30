import { db } from "./db.js";

// Insert one clickstream event. Called by the events route for every action the
// client reports, and by other routes for server-authoritative events (login,
// grading). Produces a Moodle-style "Description" sentence when the client
// hasn't supplied one, so the exported CSV reads just like a real Moodle log.

const insertStmt = db.prepare(`
  INSERT INTO events
    (ts, client_ts, user_id, session_id, component, event_name, event_context,
     description, origin, ip, route, target_type, target_id, meta, user_agent, viewport)
  VALUES
    (@ts, @client_ts, @user_id, @session_id, @component, @event_name, @event_context,
     @description, @origin, @ip, @route, @target_type, @target_id, @meta, @user_agent, @viewport)
`);

const COURSE_ID = 610; // display id used in Moodle-style sentences

// Build a human-readable Moodle-style description if one wasn't provided.
export function describe(userId, eventName, ctx = {}) {
  const u = userId ?? "guest";
  const who = `The user with id '${u}'`;
  const tid = ctx.target_id;
  const label = ctx.label || ctx.title || "";
  switch (eventName) {
    case "User logged in":
      return `${who} logged in.`;
    case "User logged out":
      return `${who} logged out.`;
    case "Course viewed":
      return `${who} viewed the course with id '${COURSE_ID}'.`;
    case "Course module viewed":
      return `${who} viewed the '${ctx.module || "lesson"}' activity with course module id '${tid}'.`;
    case "URL activity viewed":
      return `${who} viewed the 'url' activity with course module id '${tid}'.`;
    case "Element clicked":
      return `${who} clicked '${label}' on page '${ctx.route || ""}'.`;
    case "Video played":
      return `${who} played the video '${label}' at ${fmt(ctx.at)}.`;
    case "Video paused":
      return `${who} paused the video '${label}' at ${fmt(ctx.at)}.`;
    case "Video seeked":
      return `${who} sought the video '${label}' from ${fmt(ctx.from)} to ${fmt(ctx.at)}.`;
    case "Video playback rate changed":
      return `${who} changed the playback rate of video '${label}' to ${ctx.rate}x.`;
    case "Video progress":
      return `${who} reached ${ctx.percent}% of the video '${label}'.`;
    case "Video completed":
      return `${who} completed the video '${label}'.`;
    case "Video fullscreen toggled":
      return `${who} toggled fullscreen on video '${label}'.`;
    case "Quiz attempt started":
      return `${who} has started an attempt on the quiz with id '${tid}'.`;
    case "Quiz question viewed":
      return `${who} viewed question '${ctx.question || ""}' in the quiz with id '${tid}'.`;
    case "Quiz answer changed":
      return `${who} selected an answer for question '${ctx.question || ""}' in the quiz with id '${tid}'.`;
    case "Quiz attempt submitted":
      return `${who} has submitted the attempt with id '${ctx.attempt_id}' scoring ${ctx.score}/${ctx.max_score}.`;
    case "Quiz attempt reviewed":
      return `${who} has reviewed the attempt with id '${ctx.attempt_id}' for the quiz with id '${tid}'.`;
    case "User graded":
      return `${who} was graded ${ctx.score}/${ctx.max_score} on the quiz with id '${tid}'.`;
    case "Dashboard viewed":
      return `${who} viewed the analytics dashboard.`;
    case "Report exported":
      return `${who} exported the clickstream log report.`;
    default:
      return `${who} triggered '${eventName}'${label ? ` on '${label}'` : ""}.`;
  }
}

function fmt(sec) {
  if (sec == null || isNaN(sec)) return "00:00";
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Default "Event context" per component, mirroring Moodle phrasing.
export function contextFor(component, ctx = {}) {
  if (ctx.event_context) return ctx.event_context;
  switch (component) {
    case "Quiz":
      return ctx.title ? `Quiz: ${ctx.title}` : "Quiz";
    case "URL":
      return ctx.title ? `URL: ${ctx.title}` : "URL";
    case "Media":
      return ctx.title ? `Video: ${ctx.title}` : "Video";
    case "System":
    default:
      return "Course: ET 610 Learning Analytics";
  }
}

export function recordEvent(e) {
  const row = {
    ts: e.ts || new Date().toISOString(),
    client_ts: e.client_ts ?? null,
    user_id: e.user_id ?? null,
    session_id: e.session_id ?? null,
    component: e.component || "System",
    event_name: e.event_name,
    event_context: e.event_context || contextFor(e.component || "System", e),
    description: e.description || describe(e.user_id, e.event_name, e),
    origin: e.origin || "web",
    ip: e.ip ?? null,
    route: e.route ?? null,
    target_type: e.target_type ?? null,
    target_id: e.target_id != null ? String(e.target_id) : null,
    meta: e.meta ? (typeof e.meta === "string" ? e.meta : JSON.stringify(e.meta)) : null,
    user_agent: e.user_agent ?? null,
    viewport: e.viewport ?? null,
  };
  const info = insertStmt.run(row);
  return info.lastInsertRowid;
}
