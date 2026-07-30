import { useEffect, useState, createContext, useContext } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { api, type User } from "./api";
import { installAutoCapture, trackPageView, flush } from "./track";
import { Nav } from "./components/Nav";
import Login from "./pages/Login";
import CourseHome from "./pages/CourseHome";
import Lesson from "./pages/Lesson";
import Quiz from "./pages/Quiz";
import Analytics from "./pages/Analytics";

type AuthCtx = { user: User | null; setUser: (u: User | null) => void; refresh: () => Promise<void> };
const Ctx = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(Ctx);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try { const { user } = await api.me(); setUser(user); }
    catch { setUser(null); }
  };

  useEffect(() => {
    installAutoCapture();
    refresh().finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" aria-label="Loading" />;

  return (
    <Ctx.Provider value={{ user, setUser, refresh }}>
      {user ? <Shell user={user} /> : <Login />}
    </Ctx.Provider>
  );
}

function Shell({ user }: { user: User }) {
  const loc = useLocation();

  // Fire a page-view on every SPA route change (native page loads don't happen
  // in an SPA, so this is what makes route navigation show up in the log).
  useEffect(() => {
    trackPageView(loc.pathname);
    return () => { flush(); };
  }, [loc.pathname]);

  return (
    <div className="app">
      <Nav user={user} />
      <main className="page">
        <div className="container">
          <Routes>
            <Route path="/" element={<CourseHome />} />
            <Route path="/lesson/:id" element={<Lesson />} />
            <Route path="/quiz/:id" element={<Quiz />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
