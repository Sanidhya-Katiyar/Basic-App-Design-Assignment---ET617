import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "./auth.js";
import { recordEvent } from "../track.js";
import { clientIp } from "../util.js";

export const router = Router();

// Full course tree: course + lessons + quiz meta (no answers leaked).
router.get("/course", requireAuth, (req, res) => {
  const course = db.prepare("SELECT * FROM courses ORDER BY id LIMIT 1").get();
  if (!course) return res.status(404).json({ error: "No course" });
  const lessons = db.prepare("SELECT id,kind,title,body,media_url,duration,position FROM lessons WHERE course_id=? ORDER BY position").all(course.id);
  const quizzes = db.prepare("SELECT id,title,intro FROM quizzes WHERE course_id=? ORDER BY id").all(course.id);
  res.json({ course, lessons, quizzes });
});

router.get("/lesson/:id", requireAuth, (req, res) => {
  const lesson = db.prepare("SELECT * FROM lessons WHERE id=?").get(Number(req.params.id));
  if (!lesson) return res.status(404).json({ error: "No such lesson" });
  res.json({ lesson });
});

// Quiz with questions but WITHOUT correct answers (grading is server-side only).
router.get("/quiz/:id", requireAuth, (req, res) => {
  const quiz = db.prepare("SELECT * FROM quizzes WHERE id=?").get(Number(req.params.id));
  if (!quiz) return res.status(404).json({ error: "No such quiz" });
  const questions = db
    .prepare("SELECT id,prompt,options_json,marks,position FROM questions WHERE quiz_id=? ORDER BY position")
    .all(quiz.id)
    .map((q) => ({ id: q.id, prompt: q.prompt, options: JSON.parse(q.options_json), marks: q.marks, position: q.position }));
  res.json({ quiz, questions });
});

// Start an attempt — returns attempt id, logs "Quiz attempt started".
router.post("/quiz/:id/start", requireAuth, (req, res) => {
  const quiz = db.prepare("SELECT * FROM quizzes WHERE id=?").get(Number(req.params.id));
  if (!quiz) return res.status(404).json({ error: "No such quiz" });
  const maxScore = db.prepare("SELECT COALESCE(SUM(marks),0) m FROM questions WHERE quiz_id=?").get(quiz.id).m;
  const startedAt = new Date().toISOString();
  const attemptId = db
    .prepare("INSERT INTO attempts(quiz_id,user_id,started_at,max_score) VALUES(?,?,?,?)")
    .run(quiz.id, req.userId, startedAt, maxScore).lastInsertRowid;

  recordEvent({
    user_id: req.userId, session_id: req.session.id, component: "Quiz",
    event_name: "Quiz attempt started", ip: clientIp(req),
    route: `/quiz/${quiz.id}`, target_type: "quiz", target_id: quiz.id,
    title: quiz.title, meta: { attempt_id: attemptId },
  });
  res.json({ attemptId, maxScore });
});

// Submit answers — grades server-side, stores answers, logs submitted + graded.
router.post("/quiz/:id/submit", requireAuth, (req, res) => {
  const quiz = db.prepare("SELECT * FROM quizzes WHERE id=?").get(Number(req.params.id));
  if (!quiz) return res.status(404).json({ error: "No such quiz" });
  const { attemptId, answers } = req.body || {};
  const attempt = db.prepare("SELECT * FROM attempts WHERE id=? AND user_id=?").get(Number(attemptId), req.userId);
  if (!attempt) return res.status(400).json({ error: "Invalid attempt" });

  const questions = db.prepare("SELECT * FROM questions WHERE quiz_id=?").all(quiz.id);
  const chosen = new Map((answers || []).map((a) => [Number(a.questionId), a.chosenIndex]));

  let score = 0;
  const insAns = db.prepare("INSERT INTO answers(attempt_id,question_id,chosen_index,correct) VALUES(?,?,?,?)");
  const perQuestion = [];
  for (const q of questions) {
    const pick = chosen.has(q.id) ? Number(chosen.get(q.id)) : null;
    const correct = pick === q.correct_index ? 1 : 0;
    if (correct) score += q.marks;
    insAns.run(attempt.id, q.id, pick, correct);
    perQuestion.push({ questionId: q.id, chosenIndex: pick, correct: !!correct, correctIndex: q.correct_index });
  }
  const maxScore = questions.reduce((s, q) => s + q.marks, 0);
  const submittedAt = new Date().toISOString();
  db.prepare("UPDATE attempts SET submitted_at=?, score=?, max_score=? WHERE id=?").run(submittedAt, score, maxScore, attempt.id);

  const ip = clientIp(req);
  recordEvent({
    user_id: req.userId, session_id: req.session.id, component: "Quiz",
    event_name: "Quiz attempt submitted", ip, route: `/quiz/${quiz.id}`,
    target_type: "quiz", target_id: quiz.id, title: quiz.title,
    meta: { attempt_id: attempt.id, score, max_score: maxScore }, score, max_score: maxScore, attempt_id: attempt.id,
  });
  recordEvent({
    user_id: req.userId, session_id: req.session.id, component: "Quiz",
    event_name: "User graded", ip, route: `/quiz/${quiz.id}`,
    target_type: "quiz", target_id: quiz.id, title: quiz.title,
    meta: { attempt_id: attempt.id, score, max_score: maxScore }, score, max_score: maxScore,
  });

  res.json({ score, maxScore, perQuestion });
});

export default router;
