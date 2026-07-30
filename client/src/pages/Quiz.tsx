import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import { track, flush } from "../track";

type Question = { id: number; prompt: string; options: string[]; marks: number };
type Result = { score: number; maxScore: number; perQuestion: { questionId: number; chosenIndex: number | null; correct: boolean; correctIndex: number }[] };

export default function QuizPage() {
  const { id } = useParams();
  const quizId = Number(id);
  const nav = useNavigate();

  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const started = useRef(false);

  useEffect(() => {
    api.quiz(quizId).then(async (d) => {
      setQuiz(d.quiz); setQuestions(d.questions);
      if (!started.current) {
        started.current = true;
        const { attemptId } = await api.startQuiz(quizId); // logs "Quiz attempt started"
        setAttemptId(attemptId);
      }
    }).catch((e) => setErr(e.message));
  }, [quizId]);

  const choose = (q: Question, idx: number) => {
    if (result) return;
    setAnswers((a) => ({ ...a, [q.id]: idx }));
    track("Quiz answer changed", {
      component: "Quiz", target_type: "quiz", target_id: quizId, title: quiz?.title,
      question: q.prompt.slice(0, 40), meta: { questionId: q.id, chosenIndex: idx },
    });
  };

  const submit = async () => {
    if (!attemptId) return;
    setBusy(true); setErr("");
    try {
      const payload = questions.map((q) => ({ questionId: q.id, chosenIndex: answers[q.id] ?? null }));
      const r: Result = await api.submitQuiz(quizId, attemptId, payload); // logs submitted + graded
      setResult(r);
      flush();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  if (err) return <div className="notice err">{err}</div>;
  if (!quiz) return <div className="spinner" />;

  const answeredCount = Object.keys(answers).length;
  const pct = Math.round((answeredCount / questions.length) * 100);
  const scorePct = result ? Math.round((result.score / result.maxScore) * 100) : 0;
  const scoreColor = scorePct >= 60 ? "var(--accent)" : scorePct >= 40 ? "var(--gold)" : "var(--danger)";

  return (
    <>
      <div className="page-head spread">
        <div>
          <div className="eyebrow">Quiz</div>
          <h1>{quiz.title}</h1>
          {quiz.intro && <p>{quiz.intro}</p>}
        </div>
        <button className="btn secondary" data-track-label="Back to course" onClick={() => nav("/")}>← Course</button>
      </div>

      {!result && (
        <div className="card" style={{ position: "sticky", top: 68, zIndex: 5 }}>
          <div className="spread" style={{ marginBottom: 8 }}>
            <strong style={{ fontSize: 14 }}>{answeredCount} / {questions.length} answered</strong>
            <span className="muted" style={{ fontSize: 13 }}>All interactions are logged</span>
          </div>
          <div className="progressbar"><span style={{ width: `${pct}%` }} /></div>
        </div>
      )}

      {result && (
        <div className="card center">
          <div className="eyebrow">Your result</div>
          <div style={{ fontSize: 46, fontWeight: 800, color: scoreColor, letterSpacing: "-.03em" }}>
            {result.score} / {result.maxScore}
          </div>
          <p className="muted mt-0">{scorePct}% · {scorePct >= 60 ? "Passed 🎉" : "Keep practising"}</p>
          <div className="btn-row" style={{ justifyContent: "center" }}>
            <button className="btn secondary" data-track-label="Review answers"
              onClick={() => track("Quiz attempt reviewed", { component: "Quiz", target_type: "quiz", target_id: quizId, title: quiz.title, meta: { attempt_id: attemptId } })}>
              Answers reviewed below
            </button>
            <button className="btn" data-track-label="View analytics" onClick={() => nav("/analytics")}>See your analytics →</button>
          </div>
        </div>
      )}

      {questions.map((q, i) => {
        const chosen = answers[q.id];
        const rp = result?.perQuestion.find((p) => p.questionId === q.id);
        return (
          <div className="card q-card" key={q.id}>
            <h3>{i + 1}. {q.prompt}</h3>
            {q.options.map((opt, idx) => {
              let cls = "opt";
              if (result && rp) {
                if (idx === rp.correctIndex) cls += " correct";
                else if (idx === rp.chosenIndex) cls += " wrong";
              } else if (chosen === idx) cls += " selected";
              return (
                <div key={idx} className={cls}
                  data-track-label={`Q${i + 1} option ${idx + 1}`}
                  onClick={() => choose(q, idx)}>
                  <span className="radio" />
                  <span>{opt}</span>
                </div>
              );
            })}
          </div>
        );
      })}

      {!result && (
        <div className="card center">
          <button className="btn lg" disabled={busy || answeredCount === 0}
            data-track-label="Submit quiz" onClick={submit}>
            {busy ? "Submitting…" : "Submit quiz"}
          </button>
          {answeredCount < questions.length && (
            <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
              You can submit with {questions.length - answeredCount} unanswered — they'll be marked wrong.
            </p>
          )}
        </div>
      )}
    </>
  );
}
