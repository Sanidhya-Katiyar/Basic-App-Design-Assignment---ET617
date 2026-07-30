import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../App";
import { track, flush } from "../track";

export default function Login() {
  const { setUser } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const { user } = await api.login(username, password);
      // login event is recorded server-side; flush any pre-login page views too
      flush();
      setUser(user);
    } catch (e: any) {
      setErr(e.message || "Login failed");
      track("Login failed", { component: "System", label: username });
    } finally {
      setBusy(false);
    }
  };

  const quick = (u: string, p: string) => { setUsername(u); setPassword(p); };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand" style={{ justifyContent: "center", marginBottom: 18, fontSize: 22 }}>
          <span className="dot">◆</span> LearnTrace
        </div>
        <div className="card">
          <div className="eyebrow">Learner sign in</div>
          <h1 style={{ margin: "4px 0 2px", fontSize: 23 }}>Welcome back</h1>
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
            Log in to start learning. Every action you take is logged as clickstream data.
          </p>
          {err && <div className="notice err" style={{ marginBottom: 14 }}>{err}</div>}
          <form onSubmit={submit}>
            <label className="field">
              <span>Username</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)}
                autoFocus autoCapitalize="none" placeholder="alex" />
            </label>
            <label className="field">
              <span>Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" />
            </label>
            <button className="btn lg" style={{ width: "100%" }} disabled={busy} data-track-label="Sign in">
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <div className="demo-accounts">
            <div>Demo accounts (click to fill):</div>
            <span className="demo-pill" onClick={() => quick("alex", "learn123")}>👩‍🎓 alex / learn123</span>
            <span className="demo-pill" onClick={() => quick("priya", "learn123")}>👨‍🎓 priya / learn123</span>
            <span className="demo-pill" onClick={() => quick("instructor", "teach123")}>🧑‍🏫 instructor / teach123</span>
          </div>
        </div>
      </div>
    </div>
  );
}
