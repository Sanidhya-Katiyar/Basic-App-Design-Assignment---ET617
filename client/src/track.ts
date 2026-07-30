// Client-side clickstream tracker.
//
// Design goals:
//  - Never lose events on navigation/unload → buffer in memory and flush via
//    navigator.sendBeacon on `visibilitychange`/`pagehide`.
//  - Cheap during normal use → batch and flush on an interval and on demand.
//  - Capture the four categories the assignment requires: clicks, page views,
//    video actions, quiz attempts.

export type LTEvent = {
  event_name: string;
  component?: string;          // System | Quiz | Media | URL | ...
  event_context?: string;
  route?: string;
  target_type?: string;
  target_id?: string | number;
  title?: string;
  label?: string;
  module?: string;
  question?: string;
  at?: number;
  from?: number;
  rate?: number;
  percent?: number;
  score?: number;
  max_score?: number;
  attempt_id?: number;
  meta?: Record<string, unknown>;
};

const ENDPOINT = "/api/events";
const FLUSH_MS = 5000;

let buffer: any[] = [];
let flushTimer: number | undefined;
let currentRoute = location.pathname;

function viewport() {
  return `${window.innerWidth}x${window.innerHeight}`;
}

/** Queue an event. Auto-stamps client time, route and viewport. */
export function track(event_name: string, opts: Omit<LTEvent, "event_name"> = {}) {
  buffer.push({
    event_name,
    client_ts: new Date().toISOString(),
    route: opts.route ?? currentRoute,
    viewport: viewport(),
    ...opts,
  });
  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer != null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = undefined;
    flush();
  }, FLUSH_MS);
}

/** Send buffered events now. Uses sendBeacon when leaving the page. */
export function flush(useBeacon = false) {
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];
  const payload = JSON.stringify({ events: batch });

  if (useBeacon && navigator.sendBeacon) {
    // text/plain avoids a CORS preflight and is what the server's text parser expects.
    const ok = navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: "text/plain" }));
    if (!ok) buffer = batch.concat(buffer); // re-queue on failure
    return;
  }

  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    credentials: "include",
    keepalive: true,
  }).catch(() => {
    // network hiccup: put them back so we retry on the next flush
    buffer = batch.concat(buffer);
  });
}

/** Called by the router whenever the SPA location changes. */
export function trackPageView(pathname: string, meta?: Record<string, unknown>) {
  currentRoute = pathname;
  // Map route → a Moodle-ish event name.
  let event_name = "Page viewed";
  let component = "System";
  if (pathname === "/" || pathname.startsWith("/course")) event_name = "Course viewed";
  else if (pathname.startsWith("/lesson")) event_name = "Course module viewed";
  else if (pathname.startsWith("/quiz")) event_name = "Quiz page viewed", (component = "Quiz");
  else if (pathname.startsWith("/analytics")) event_name = "Dashboard viewed";
  track(event_name, { component, route: pathname, meta });
}

// --- global auto-capture ----------------------------------------------------

let installed = false;

/** Install document-level listeners once (delegated clicks + unload flush). */
export function installAutoCapture() {
  if (installed) return;
  installed = true;

  // Delegated click capture — every click anywhere becomes an event, with a
  // best-effort human label from the nearest button/link/aria-label/text.
  document.addEventListener(
    "click",
    (e) => {
      const el = (e.target as HTMLElement)?.closest(
        "button, a, [role=button], input[type=submit], .track-click"
      ) as HTMLElement | null;
      if (!el) return;
      const label =
        el.getAttribute("data-track-label") ||
        el.getAttribute("aria-label") ||
        el.textContent?.trim().slice(0, 60) ||
        el.getAttribute("title") ||
        el.tagName.toLowerCase();
      track("Element clicked", {
        component: "System",
        label,
        target_type: el.tagName.toLowerCase(),
        meta: { id: el.id || undefined, href: (el as HTMLAnchorElement).href || undefined },
      });
    },
    true // capture phase → we see the click even if handlers stopPropagation
  );

  // Flush pending events when the tab is hidden or the page is being unloaded.
  const beaconFlush = () => flush(true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") beaconFlush();
  });
  window.addEventListener("pagehide", beaconFlush);
  window.addEventListener("beforeunload", beaconFlush);
}
