# LearnTrace — a learning app with full clickstream tracking

LearnTrace is a small e-learning web app where learners log in, work through
**interactive content (text, video, and a quiz)**, and where **every action they
take is captured as clickstream data** and stored. The captured events use the
**exact same 7-column shape as a Moodle log export**, and the app can export that
log as a CSV that lines up column-for-column with a real Moodle report.

Built for the **ET 610 — Learning Analytics & Educational Data Mining** assignment.

---

## What it does

- **Learner login** — session-cookie auth over scrypt-hashed passwords.
- **Interactive content**
  - a **text** lesson (rich HTML),
  - a **video** lesson (bundled Big Buck Bunny clip) with a live event feed,
  - a **URL/resource** lesson (external link),
  - a graded **multiple-choice quiz**.
- **Full activity tracking** — clicks, page views, video actions
  (play / pause / seek / rate change / progress milestones / completion), and
  the whole quiz lifecycle (attempt started → each answer change → submitted →
  graded) are all logged.
- **Clickstream storage** — every event is a row in a SQLite `events` table.
- **Analytics dashboard** — totals, events-by-type, per-learner activity,
  component breakdown, quiz performance, and a live activity feed.
- **CSV export** — download the log in Moodle's exact 7 columns:
  `Time · Event context · Component · Event name · Description · Origin · IP address`.

---

## Tech stack

| Layer      | Choice                                                    |
|------------|-----------------------------------------------------------|
| Frontend   | React + TypeScript + Vite (SPA, React Router)             |
| Backend    | Node.js + Express                                         |
| Database   | SQLite via Node's built-in `node:sqlite` (no native build)|
| Auth       | httpOnly session cookie + `node:crypto` scrypt hashing    |
| Styling    | Hand-written CSS design system (light + dark)             |

No cloud services, no API keys — it runs entirely locally and offline, which
makes it easy to record a demo video.

---

## Running it

Requires **Node 22.5+** (for the built-in `node:sqlite` module; developed on Node 26).

```bash
npm install
npm run reset      # create + seed the database (demo learners, course, quiz,
                   #   and a little starter clickstream history)

# Development (two processes, hot reload):
npm run dev        # Vite client on :5173  +  API server on :4000
# open http://localhost:5173

# — or — Production (single process, one URL, best for the demo video):
npm run serve      # builds the client and serves it + the API from :4000
# open http://localhost:4000
```

### Demo accounts

| Username     | Password   | Role       |
|--------------|------------|------------|
| `alex`       | `learn123` | learner    |
| `priya`      | `learn123` | learner    |
| `sam`        | `learn123` | learner    |
| `instructor` | `teach123` | instructor |

---

## How the clickstream works

1. **Client** (`client/src/track.ts`) buffers events in memory and flushes them
   to `POST /api/events`:
   - every 5 seconds,
   - on each SPA route change,
   - and — crucially — on `visibilitychange` / `pagehide` via
     **`navigator.sendBeacon`**, so no events are lost when the user navigates
     away or closes the tab.
   - A document-level capture-phase click listener records **every** click, and
     a router hook records a **page view** on each route change (SPA route
     changes don't trigger native page loads).
2. **Server** (`server/track.js`) stamps each event with server time, the
   session's user, the client IP, and generates a **Moodle-style description
   sentence** (e.g. *"The user with id '1' played the video 'Intro' at 00:03."*).
3. **Storage** — one row per event in the `events` table (see `server/schema.sql`),
   a superset of the 7 Moodle columns plus richer fields (`route`, `target_id`,
   `meta` JSON, viewport, user-agent…).
4. **Export** (`GET /api/export/clickstream.csv`) projects those rows down to the
   exact Moodle 7 columns, with `Time` formatted as Moodle's `D/MM/YY, HH:MM:SS`.

> On localhost the IP column shows `127.0.0.1` (loopback normalised from IPv6
> `::1`); the seeded history uses `10.0.0.x` so the export resembles a real log.

### Event taxonomy (excerpt)

| Category    | Component | Example event names                                             |
|-------------|-----------|-----------------------------------------------------------------|
| Navigation  | System    | `Course viewed`, `Course module viewed`, `Page viewed`          |
| Auth        | System    | `User logged in`, `User logged out`                             |
| Clicks      | System    | `Element clicked` (with the clicked label + route)              |
| Video       | Media     | `Video played/paused/seeked`, `Video progress`, `Video completed`, `Video playback rate changed` |
| Resource    | URL       | `URL activity viewed`, `URL link followed`                      |
| Quiz        | Quiz      | `Quiz attempt started`, `Quiz answer changed`, `Quiz attempt submitted`, `User graded`, `Quiz attempt reviewed` |
| Reporting   | Logs      | `Report exported`                                               |

---

## Project layout

```
learntrace/
├── server/
│   ├── index.js            # Express app: API + static SPA serving
│   ├── db.js               # node:sqlite init + schema apply
│   ├── schema.sql          # tables (incl. the events clickstream table)
│   ├── seed.js             # demo data + starter clickstream history
│   ├── track.js            # event insert + Moodle-sentence generation
│   ├── auth-util.js        # scrypt password hashing
│   ├── util.js             # client-IP normalisation
│   └── routes/             # auth · content · events · analytics · export
├── client/
│   ├── index.html
│   ├── vite.config.ts      # dev proxy /api → :4000
│   └── src/
│       ├── track.ts        # clickstream buffer + sendBeacon flush + auto-capture
│       ├── api.ts
│       ├── App.tsx         # router + per-route page-view tracking
│       ├── pages/          # Login · CourseHome · Lesson · Quiz · Analytics
│       └── components/     # Nav · VideoPlayer · QuizRunner
└── client/public/media/intro.mp4   # bundled demo video
```

---

## npm scripts

| Script          | What it does                                            |
|-----------------|---------------------------------------------------------|
| `npm run dev`   | Vite client (:5173) + API (:4000) with hot reload       |
| `npm run serve` | Build the client, then serve everything from :4000      |
| `npm run seed`  | Seed the DB if empty                                    |
| `npm run reset` | Wipe + reseed (adds starter clickstream history)        |
| `npm run build` | Build the client into `dist/`                           |

---

## Credits

- Demo video: *Big Buck Bunny* © Blender Foundation — [peach.blender.org](https://peach.blender.org) (CC BY 3.0).
- Clickstream column format modelled on Moodle's standard log report.
