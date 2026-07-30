// Thin fetch wrapper. All requests send cookies (session auth).

async function req(path: string, opts: RequestInit = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

export const api = {
  me: () => req("/api/auth/me"),
  login: (username: string, password: string) =>
    req("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => req("/api/auth/logout", { method: "POST" }),

  course: () => req("/api/course"),
  lesson: (id: number) => req(`/api/lesson/${id}`),
  quiz: (id: number) => req(`/api/quiz/${id}`),
  startQuiz: (id: number) => req(`/api/quiz/${id}/start`, { method: "POST" }),
  submitQuiz: (id: number, attemptId: number, answers: { questionId: number; chosenIndex: number | null }[]) =>
    req(`/api/quiz/${id}/submit`, { method: "POST", body: JSON.stringify({ attemptId, answers }) }),

  analytics: () => req("/api/analytics/summary"),
};

export type User = { id: number; username: string; name: string; role: string };
