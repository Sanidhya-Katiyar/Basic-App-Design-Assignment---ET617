import { NavLink } from "react-router-dom";
import { api, type User } from "../api";
import { useAuth } from "../App";
import { track, flush } from "../track";

export function Nav({ user }: { user: User }) {
  const { setUser } = useAuth();

  const logout = async () => {
    track("Logout clicked", { component: "System", label: "Log out" });
    flush();
    try { await api.logout(); } finally { setUser(null); }
  };

  return (
    <header className="nav">
      <div className="container nav-inner">
        <div className="brand">
          <span className="dot">◆</span> LearnTrace
        </div>
        <nav className="nav-links">
          <NavLink to="/" end>Course</NavLink>
          <NavLink to="/analytics">Analytics</NavLink>
          <span className="who">{user.name} · {user.role}</span>
          <button className="btn ghost" data-track-label="Log out" onClick={logout}>Log out</button>
        </nav>
      </div>
    </header>
  );
}
