import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import { track } from "../track";
import { VideoPlayer } from "../components/VideoPlayer";

type Lesson = { id: number; kind: string; title: string; body?: string; media_url?: string; duration?: number };

export default function LessonPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setLesson(null);
    api.lesson(Number(id)).then((d) => {
      setLesson(d.lesson);
      const l: Lesson = d.lesson;
      const component = l.kind === "video" ? "Media" : l.kind === "url" ? "URL" : "System";
      const event_name = l.kind === "url" ? "URL activity viewed" : "Course module viewed";
      track(event_name, { component, module: l.kind, target_type: "lesson", target_id: l.id, title: l.title });
    }).catch((e) => setErr(e.message));
  }, [id]);

  if (err) return <div className="notice err">{err}</div>;
  if (!lesson) return <div className="spinner" />;

  const openUrl = () => {
    track("URL link followed", { component: "URL", label: lesson.title, target_type: "lesson", target_id: lesson.id, title: lesson.title, meta: { href: lesson.media_url } });
  };

  return (
    <>
      <div className="page-head spread">
        <div>
          <div className="eyebrow">{lesson.kind} lesson</div>
          <h1>{lesson.title}</h1>
        </div>
        <button className="btn secondary" data-track-label="Back to course" onClick={() => nav("/")}>← Course</button>
      </div>

      {lesson.kind === "video" && lesson.media_url && (
        <div className="card">
          <VideoPlayer src={lesson.media_url} title={lesson.title} targetId={lesson.id} />
          {lesson.body && <div className="lesson-content mt-16" dangerouslySetInnerHTML={{ __html: lesson.body }} />}
        </div>
      )}

      {lesson.kind === "url" && (
        <div className="card">
          {lesson.body && <div className="lesson-content" dangerouslySetInnerHTML={{ __html: lesson.body }} />}
          <div className="btn-row mt-16">
            <a className="btn" href={lesson.media_url} target="_blank" rel="noreferrer"
               data-track-label={`Follow URL: ${lesson.title}`} onClick={openUrl}>
              Open resource ↗
            </a>
          </div>
        </div>
      )}

      {lesson.kind === "text" && (
        <div className="card">
          <div className="lesson-content" dangerouslySetInnerHTML={{ __html: lesson.body || "" }} />
        </div>
      )}

      <div className="card">
        <div className="spread">
          <span className="muted" style={{ fontSize: 14 }}>Finished this lesson?</span>
          <div className="btn-row">
            <button className="btn secondary" data-track-label="Next: back to course" onClick={() => nav("/")}>Back to course</button>
            <button className="btn" data-track-label="Go to quiz" onClick={() => nav("/quiz/1")}>Take the quiz →</button>
          </div>
        </div>
      </div>
    </>
  );
}
