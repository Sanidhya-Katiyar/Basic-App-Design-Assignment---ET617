import { useEffect, useState } from "react";
import { api } from "../api";
import { track } from "../track";

export default function Analytics() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");

  const load = () => api.analytics().then(setD).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  if (err) return <div className="notice err">{err}</div>;
  if (!d) return <div className="spinner" />;

  const maxEvent = Math.max(1, ...d.byEvent.map((e: any) => e.count));
  const maxUser = Math.max(1, ...d.perUser.map((u: any) => u.events));

  const download = () => {
    track("Report exported", { component: "Logs", label: "Download clickstream CSV" });
    window.open("/api/export/clickstream.csv", "_blank");
  };

  return (
    <>
      <div className="page-head spread">
        <div>
          <div className="eyebrow">Learning analytics</div>
          <h1>Clickstream dashboard</h1>
          <p>Every action across the app, aggregated. This is the data a Learning Analytics course studies.</p>
        </div>
        <div className="btn-row">
          <button className="btn secondary" data-track-label="Refresh analytics" onClick={load}>↻ Refresh</button>
          <button className="btn" data-track-label="Download clickstream CSV" onClick={download}>⬇ Download CSV</button>
        </div>
      </div>

      <div className="grid cols-4">
        <Stat label="Total events" value={d.totals.events} sub="clickstream rows" />
        <Stat label="Learners tracked" value={d.totals.users} sub="distinct users" />
        <Stat label="Sessions" value={d.totals.sessions} sub="login sessions" />
        <Stat label="Event types" value={d.byEvent.length} sub="distinct actions" />
      </div>

      <div className="grid cols-2 mt-24">
        <div className="card">
          <h3 className="mt-0">Events by type</h3>
          {d.byEvent.map((e: any) => (
            <div className="bar-row" key={e.event_name}>
              <span className="name" title={e.event_name}>{e.event_name}</span>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${(e.count / maxEvent) * 100}%` }} /></div>
              <span className="num">{e.count}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 className="mt-0">Activity by learner</h3>
          {d.perUser.map((u: any) => (
            <div className="bar-row" key={u.id}>
              <span className="name">{u.name}</span>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${(u.events / maxUser) * 100}%`, background: "linear-gradient(90deg,var(--accent),#3bd7a5)" }} /></div>
              <span className="num">{u.events}</span>
            </div>
          ))}
          <h3>Events by component</h3>
          <div className="btn-row" style={{ gap: 8 }}>
            {d.byComponent.map((c: any) => (
              <span key={c.component} className="chip" style={{ fontSize: 12 }}>{c.component}: {c.count}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="card mt-24">
        <h3 className="mt-0">Quiz performance</h3>
        {d.quizScores.length === 0 ? (
          <p className="muted mb-0">No quiz attempts submitted yet. Take the quiz to populate this.</p>
        ) : (
          <table className="data">
            <thead><tr><th>Learner</th><th>Quiz</th><th>Score</th><th>%</th><th>Submitted</th></tr></thead>
            <tbody>
              {d.quizScores.map((s: any) => {
                const pct = Math.round((s.score / s.max_score) * 100);
                const color = pct >= 60 ? "var(--accent)" : pct >= 40 ? "var(--gold)" : "var(--danger)";
                return (
                  <tr key={s.attempt_id}>
                    <td>{s.learner}</td>
                    <td>{s.quiz}</td>
                    <td>{s.score}/{s.max_score}</td>
                    <td><span className="pill-score" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>{pct}%</span></td>
                    <td className="muted">{new Date(s.submitted_at).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card mt-24">
        <h3 className="mt-0">Recent activity feed</h3>
        <div className="event-feed" style={{ maxHeight: 340 }}>
          {d.recent.map((e: any, i: number) => (
            <div className="ev" key={i}>
              <span className="t">{new Date(e.ts).toLocaleTimeString()}</span>
              <span className="n">{e.event_name}</span>
              <span className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.description}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
