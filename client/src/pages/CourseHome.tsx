import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { track } from "../track";

type Lesson = { id: number; kind: string; title: string; body?: string; duration?: number };
type Quiz = { id: number; title: string; intro?: string };

const KIND = {
  text: { ico: "📄", cls: "ico-text", chip: "Reading" },
  video: { ico: "▶", cls: "ico-video", chip: "Video" },
  url: { ico: "🔗", cls: "ico-url", chip: "Link" },
} as const;

export default function CourseHome() {
  const nav = useNavigate();
  const [data, setData] = useState<{ course: any; lessons: Lesson[]; quizzes: Quiz[] } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => { api.course().then(setData).catch((e) => setErr(e.message)); }, []);

  if (err) return <div className="notice err">{err}</div>;
  if (!data) return <div className="spinner" />;

  const openLesson = (l: Lesson) => {
    track("Lesson opened", { component: "System", label: l.title, target_type: "lesson", target_id: l.id });
    nav(`/lesson/${l.id}`);
  };
  const openQuiz = (q: Quiz) => {
    track("Quiz opened", { component: "Quiz", label: q.title, target_type: "quiz", target_id: q.id, title: q.title });
    nav(`/quiz/${q.id}`);
  };

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Interactive learning</div>
        <h1>Understanding Learning Analytics</h1>
        <p>Work through the lessons, watch the video, and take the quiz — while every action you take is captured as clickstream data. Learn how learning platforms understand learner behaviour by seeing it happen to you.</p>
      </div>

      <div className="card">
        <div className="spread" style={{ marginBottom: 16 }}>
          <h3 className="mt-0 mb-0">Course content</h3>
          <span className="badge-live"><span className="pulse" /> tracking active</span>
        </div>
        <div className="grid" style={{ gap: 10 }}>
          {data.lessons.map((l) => {
            const k = KIND[l.kind as keyof typeof KIND] ?? KIND.text;
            return (
              <div key={l.id} className="lesson-row" onClick={() => openLesson(l)}
                   data-track-label={`Open lesson: ${l.title}`}>
                <div className={`lesson-ico ${k.cls}`}>{k.ico}</div>
                <div className="meta">
                  <h3>{l.title}</h3>
                  <p>{k.chip}{l.duration ? ` · ${l.duration}s` : ""}</p>
                </div>
                <span className="chip">{k.chip}</span>
              </div>
            );
          })}
          {data.quizzes.map((q) => (
            <div key={`q${q.id}`} className="lesson-row" onClick={() => openQuiz(q)}
                 data-track-label={`Open quiz: ${q.title}`}>
              <div className="lesson-ico ico-quiz">✎</div>
              <div className="meta">
                <h3>{q.title}</h3>
                <p>Quiz · graded</p>
              </div>
              <span className="chip">Quiz</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="mt-0">How your activity is tracked</h3>
        <p className="muted mb-0" style={{ fontSize: 14.5 }}>
          LearnTrace records every click, page view, video action and quiz interaction as a
          clickstream event — in the same 7-column format Moodle uses
          (<code style={{fontFamily:"var(--mono)"}}>Time · Event context · Component · Event name · Description · Origin · IP</code>).
          Head to the <b>Analytics</b> tab to see the live log and download it as CSV.
        </p>
      </div>
    </>
  );
}
