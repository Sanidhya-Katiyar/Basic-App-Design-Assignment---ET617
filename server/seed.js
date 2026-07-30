// Seeds the database with learners, a course, lessons (text/video/url) and a
// quiz. Run `npm run seed` (safe to re-run) or `npm run reset` (wipes first).
// With --reset it also fabricates a little historical clickstream for two of
// the learners so the analytics dashboard and CSV export look real on day one.

import { db } from "./db.js";
import { hashPassword } from "./auth-util.js";
import { recordEvent } from "./track.js";

const RESET = process.argv.includes("--reset");

if (RESET) {
  for (const t of ["answers", "attempts", "events", "sessions", "questions", "quizzes", "lessons", "courses", "users"]) {
    db.exec(`DELETE FROM ${t};`);
  }
  console.log("Wiped existing data.");
}

const now = () => new Date().toISOString();

function count(table) {
  return db.prepare(`SELECT COUNT(*) c FROM ${table}`).get().c;
}

if (count("users") === 0) {
  const learners = [
    { username: "alex",  name: "Alex Rivera",   pw: "learn123" },
    { username: "priya", name: "Priya Nair",    pw: "learn123" },
    { username: "sam",   name: "Sam Okafor",    pw: "learn123" },
  ];
  const insUser = db.prepare(
    "INSERT INTO users(username,name,password_hash,role,created_at) VALUES(?,?,?,?,?)"
  );
  for (const l of learners) {
    insUser.run(l.username, l.name, hashPassword(l.pw), "learner", now());
  }
  // A demo instructor account, so the analytics view has an "admin-ish" login too.
  insUser.run("instructor", "Dr. Morgan Lee", hashPassword("teach123"), "instructor", now());
  console.log(`Seeded ${learners.length} learners + 1 instructor (password: learn123 / teach123).`);
}

let course = db.prepare("SELECT * FROM courses LIMIT 1").get();
if (!course) {
  const cid = db
    .prepare("INSERT INTO courses(code,title,summary) VALUES(?,?,?)")
    .run(
      "ET 610",
      "Learning Analytics & Educational Data Mining",
      "An introductory course on how learning platforms capture and analyse learner behaviour."
    ).lastInsertRowid;
  course = db.prepare("SELECT * FROM courses WHERE id=?").get(cid);

  const insLesson = db.prepare(
    "INSERT INTO lessons(course_id,kind,title,body,media_url,duration,position) VALUES(?,?,?,?,?,?,?)"
  );

  insLesson.run(course.id, "text", "What is Learning Analytics?",
    `<h2>What is Learning Analytics?</h2>
     <p><strong>Learning Analytics (LA)</strong> is the measurement, collection, analysis and
     reporting of data about learners and their contexts, for purposes of understanding and
     optimising learning and the environments in which it occurs.</p>
     <p>Every time you open a lesson, play a video, or answer a quiz question, the platform can
     record a <em>clickstream event</em>. In this course you are the learner <b>and</b> the data —
     the app you're using right now is logging your activity in the exact same 7-column format a
     real Moodle server would.</p>
     <h3>The clickstream columns</h3>
     <ul>
       <li><b>Time</b> — when the action happened</li>
       <li><b>Event context</b> — where in the course it happened</li>
       <li><b>Component</b> — the subsystem (System, Quiz, Media, URL…)</li>
       <li><b>Event name</b> — the action type</li>
       <li><b>Description</b> — a human-readable sentence</li>
       <li><b>Origin</b> — web / ws / cli</li>
       <li><b>IP address</b> — the network origin</li>
     </ul>
     <p>Read on, watch the short video, then take the quiz. Afterwards, open the
     <b>Analytics</b> tab to see your own footprint and download the raw log.</p>`,
    null, null, 1);

  insLesson.run(course.id, "video", "Intro Video: Data in Motion",
    `<p>This short clip is here so you can generate <b>video-action</b> events — play, pause,
     seek, rate change, progress milestones and completion are all tracked.</p>`,
    "/media/intro.mp4", 10, 2);

  insLesson.run(course.id, "url", "Further Reading: The LAK Handbook",
    `<p>An external resource. Opening it logs a <code>URL activity viewed</code> event, just like
     Moodle's URL module.</p>`,
    "https://www.solaresearch.org/publications/hla/", null, 3);

  // Quiz
  const qid = db
    .prepare("INSERT INTO quizzes(course_id,title,intro) VALUES(?,?,?)")
    .run(course.id, "Pre-Test Quiz: Learning Analytics Basics",
      "Five quick questions. Your attempt, each answer change, and your final grade are all logged.")
    .lastInsertRowid;

  const insQ = db.prepare(
    "INSERT INTO questions(quiz_id,prompt,options_json,correct_index,marks,position) VALUES(?,?,?,?,?,?)"
  );
  const questions = [
    { p: "What does a 'clickstream' primarily record?",
      o: ["A user's sequence of interaction events", "The CPU clock speed", "Only login times", "Video resolution"], c: 0 },
    { p: "Which of these is NOT one of the 7 Moodle log columns?",
      o: ["Event name", "Component", "Favourite colour", "IP address"], c: 2 },
    { p: "In this app, which component is used for video events?",
      o: ["System", "Media", "Forum", "Wiki"], c: 1 },
    { p: "What is the main purpose of Learning Analytics?",
      o: ["To sell ads", "To understand and optimise learning", "To slow down servers", "To replace teachers"], c: 1 },
    { p: "Which event fires when you finish watching the whole video?",
      o: ["Video paused", "Quiz attempt started", "Video completed", "User logged out"], c: 2 },
  ];
  questions.forEach((q, i) => insQ.run(qid, q.p, JSON.stringify(q.o), q.c, 2, i + 1));

  console.log(`Seeded course "${course.title}" with 3 lessons + a ${questions.length}-question quiz.`);
}

// Fabricate a little history so the dashboard isn't empty (only on --reset).
if (RESET) {
  const users = db.prepare("SELECT id FROM users WHERE role='learner'").all();
  const lessons = db.prepare("SELECT * FROM lessons").all();
  const base = Date.parse("2026-07-28T09:00:00Z");
  let clock = base;
  const step = () => new Date((clock += 45_000 + Math.floor(Math.sin(clock) * 10_000 + 20_000))).toISOString();

  for (const u of users.slice(0, 2)) {
    recordEvent({ user_id: u.id, component: "System", event_name: "User logged in", ts: step(), ip: "10.0.0." + u.id, route: "/login", origin: "web" });
    recordEvent({ user_id: u.id, component: "System", event_name: "Course viewed", ts: step(), ip: "10.0.0." + u.id, route: "/", origin: "web" });
    for (const ls of lessons) {
      const comp = ls.kind === "video" ? "Media" : ls.kind === "url" ? "URL" : "System";
      const ev = ls.kind === "url" ? "URL activity viewed" : "Course module viewed";
      recordEvent({ user_id: u.id, component: comp, event_name: ev, ts: step(), ip: "10.0.0." + u.id,
        route: `/lesson/${ls.id}`, target_type: "lesson", target_id: ls.id, title: ls.title, module: ls.kind });
      if (ls.kind === "video") {
        recordEvent({ user_id: u.id, component: "Media", event_name: "Video played", ts: step(), ip: "10.0.0." + u.id, route: `/lesson/${ls.id}`, target_type: "video", target_id: ls.id, title: ls.title, at: 0 });
        recordEvent({ user_id: u.id, component: "Media", event_name: "Video progress", ts: step(), ip: "10.0.0." + u.id, route: `/lesson/${ls.id}`, target_type: "video", target_id: ls.id, title: ls.title, percent: 50 });
        recordEvent({ user_id: u.id, component: "Media", event_name: "Video completed", ts: step(), ip: "10.0.0." + u.id, route: `/lesson/${ls.id}`, target_type: "video", target_id: ls.id, title: ls.title });
      }
    }
  }
  console.log("Fabricated a starter clickstream history for 2 learners.");
}

console.log("Seed complete. Events in DB:", count("events"));
