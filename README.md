<p align="center">
  <img src="app/icon.png" alt="Technova logo" width="110" height="110">
</p>

<h1 align="center">Technova</h1>

<p align="center">
  <strong>The website and admin platform of Technova, the technical society of Sharda University (SSCSE).</strong><br>
  Events, registrations, QR check-in, certificates, clubs, XP and analytics, in one Next.js app.
</p>

<p align="center">
  <a href="https://www.technovashardauniversity.in">Live site</a> ·
  <a href="#features">Features</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#deployment">Deployment</a> ·
  <a href="BUGS.md">Bug audit</a> ·
  <a href="FEATURES.md">Roadmap</a>
</p>

---

## About

Technova is the official technical society of the Sharda School of Computing Science and Engineering. This repository is the society's website: students discover events, register, check in with a QR code, give feedback, earn XP and download verified certificates; organisers run everything from the admin panel.

The production database holds real student data (all B.Tech registrations, attendance, XP and certificates). Read [Working with production data](#working-with-production-data) before touching it.

---

## Features

### For students

| Feature | What it does |
|---|---|
| Events | Server-rendered, CDN-cached list with search, club filter and Online / On campus filter. "Show all past events" timeline. |
| Event page | Registration (free or Razorpay), capacity and "registrations closed" handling, QR ticket, meeting link for registered students, feedback, Add to Google Calendar / Apple / Outlook (.ics), WhatsApp / copy-link sharing, referral "Share & Earn XP". |
| Dashboard | Real XP, rank, events attended and certificates; upcoming registrations with ticket and calendar links; open events; past events with certificate downloads. |
| Certificates | Download, public verification page (`/verify/<id>`), one-click "Add to LinkedIn". |
| Leaderboard and profile | XP history, weekly / monthly / all-time leaderboards (check-in XP included). |
| Clubs and leadership | Club pages with team, contacts and past events; executive council and mentors. |
| DevSpace | Community posts, project showcase, Buddy Finder (sign-in required), academic resources (PYQs, notes). |
| Installable | Web app manifest: "Add to Home Screen" on phones. |

### For organisers (admin panel, `/admin`)

| Feature | What it does |
|---|---|
| Events | Create / edit / past events, banners (auto-resized to WebP on upload), registrations table, CSV export, blast email, Stop Registrations switch. |
| Bulk Attendance | `/admin/events/<id>/attendance`: upload a Google Meet / Zoom attendance CSV (matched by email or system ID, never by name) or tick students; per day for multi-day events; same XP as a QR scan, never awarded twice. |
| Event Report (PDF) | One click on an event: branded A4 report for the HOD/Dean with registrations, turnout, audience by year/course, ratings and an AI-written summary. |
| Certificates | Per-event workspace (participation templates with fonts, Top 1/2/3 position certificates, bulk send). Plus a hub (`/admin/certificates`) across all events: not emailed, pending, revoked, downloads, search by ID or student. |
| Feedback | Form builder, responses, ratings, and "Summarise comments" (AI groups written comments into praise / complaints / suggestions). |
| Analytics | `/admin/analytics`: KPIs, monthly activity, year and course mix, club comparison, ratings, repeat participation, XP spread, sortable table of every event. |
| Ask Technova | `/admin/insights`: ask questions in plain English ("Which 5 events had the best turnout?") and get an answer with a chart. Details under [AI features](#ai-features). |
| People | `/admin/people`: look up any student's events, attendance, certificates and XP. |
| Admin Roles | `/admin/roles`: make anyone Super Admin (full panel), Admin (scanner only) or Student; confirmation, no self-change, never zero super admins, change history. |
| Scanners and hackathon portal | QR check-in, gate / food / attendance scanners, hackathon team management and evaluation. |

### AI features

All AI calls go to NVIDIA's hosted models (`NAPI_KEY`), currently **Nemotron 3 Super** with **Nemotron 3.5 Lightning** as automatic fallback (`lib/ai/nvidia.ts`).

- **The AI never touches the database and never writes SQL.** Ask Technova can only call 8 fixed, read-only tools (`lib/ai/insights.ts`) that compute from an anonymous analytics snapshot (`lib/analytics/`): no names, emails, phone numbers, system IDs or comments.
- Every number in a chart is filled in on the server from a tool result, so a chart can't show a number the database didn't produce.
- Feedback summaries send only long-answer comments, with emails and numbers redacted.
- Super admins only, 40 questions/hour each. Warm-up runs when the page opens or the sidebar link is hovered.

---

## Architecture

```
app/
  (public)/        Public pages. Pre-built and CDN-cached (Home, Events, Clubs, Leadership, Partners)
  (dashboard)/     Signed-in student area: dashboard, profile, leaderboard
  (admin)/admin/   Admin panel (super admins), incl. analytics, insights, certificates, people, roles
  (auth)/          Login, onboarding, auth errors
  (scanner)/, (hackathon-portal)/, (evaluator)/   Event-day tools
  events/[id]/     Event page (registration, ticket, feedback)
  api/             Route handlers: certificates, reports, insights, cron, Razorpay webhook, .ics
components/        UI (landing/ holds the landing page and its motion primitives)
lib/
  actions/         Server actions ('use server'). Each one checks the caller's role itself
  analytics/       Anonymous dataset + metric functions (dashboard, PDF report, AI)
  ai/              NVIDIA client, Ask Technova tools, feedback themes
  data/            Cached readers for public pages (unstable_cache + tags)
  reports/         Event report PDF (pdf-lib)
  certificates/    Certificate PDF generation (pdf-lib + fontkit, custom text layout)
  xp/, dates/, calendar/, email/, server/, supabase/
supabase/
  migrations/      SQL migrations (applied manually in the Supabase SQL editor)
  rollbacks/       Matching rollback scripts
tests/             Vitest unit tests
scripts/one-off/   Old maintenance scripts (some change production data; read the README there)
```

### How the app talks to the database

- Server code uses the Supabase **service-role key** (bypasses row-level security). Every server action and route checks the user's role first. The browser never gets the service key.
- The public **anon key** is only used for community posts, comments, projects and resources.
- Sessions are stored in the database (Auth.js Supabase adapter). `auth()` is deduplicated per request (`lib/auth/index.ts`), and the proxy only runs on routes that need its redirects (`proxy.ts`).
- Supabase returns at most 1,000 rows per request; use `fetchAllRows` / `fetchInChunks` (`lib/supabase/fetch-all.ts`) for anything that can grow.
- All dates shown to users are IST (`lib/dates/ist.ts`, `lib/utils.ts`).

### Performance notes

- Vercel functions run in **Mumbai (`bom1`)**, next to the Supabase database (`ap-south-1`); see `vercel.json`. Running in the default US region added ~200 ms to every query.
- Public pages are static with ISR (1–5 min). The navbar loads the signed-in user in the browser (`components/auth/use-session-user.ts`), which is what keeps those pages cacheable.
- Admin edits clear caches immediately with `revalidateTag` (`public-events`, `event-detail`, `resources`, `clubs`, `analytics`).
- Images: everything in `public/` is sized for its display (×2 for retina); event banners and photos go through `next/image` (AVIF/WebP). Use `components/ui/banner-image.tsx` / `team-photo.tsx` for new images.
- The landing hero animates with plain CSS so it shows on first paint; motion respects "reduce motion".

---

## Tech stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS · Framer Motion · Radix / shadcn UI · Supabase (Postgres, Storage) · Auth.js v5 (Google) · Resend + React Email · Razorpay · pdf-lib · Recharts · sharp · NVIDIA NIM API · Vitest

---

## Getting started

Requirements: Node.js 20+, a Supabase project, a Google OAuth client.

```bash
git clone https://github.com/technova-sharda/technova_website_v2.git
cd technova_website_v2
npm install
cp .env.example .env      # fill in the values
npm run dev               # http://localhost:3000
```

Use your **own** Supabase project for development (apply the SQL files in `supabase/migrations/` in order). The dev server compiles each page on first visit, so it's much slower than production; measure speed with `npm run build && npm start`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | TypeScript (must be 0 errors; the build enforces it) |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests (IST dates, calendar files, attendance matching, XP split, analytics) |

### Environment variables

See `.env.example`. Beyond Supabase, Auth.js, Resend and Razorpay:

| Variable | Used for |
|---|---|
| `CRON_SECRET` | Authenticates the event reminder job (`/api/cron/event-reminders`) |
| `NAPI_KEY` | NVIDIA API key for Ask Technova, report summaries and feedback themes |
| `NVIDIA_MODEL`, `NVIDIA_FALLBACK_MODEL`, `NVIDIA_THINKING` | Optional model overrides |

---

## Deployment

The site deploys on **Vercel** from `main`.

1. Environment variables in Vercel (Project → Settings → Environment Variables): everything in `.env.example`, including `CRON_SECRET` and `NAPI_KEY`.
2. Region: `vercel.json` pins functions to `bom1` (Mumbai). Check Project → Settings → Functions after deploying.
3. Event reminders: `.github/workflows/event-reminders.yml` calls the reminder job every 30 minutes once the GitHub repository secret `CRON_SECRET` is set (same value as Vercel). It does nothing until then.
4. Database changes are **not** applied automatically. Run new files from `supabase/migrations/` in the Supabase SQL editor, outside live events, after a backup. Each has a rollback in `supabase/rollbacks/`.
5. Avoid deploying while an event is live (scanners and registrations are in use).

---

## Working with production data

- It's real student data. Read-only investigation first; wrap ad-hoc SQL in `BEGIN READ ONLY; … ROLLBACK;`.
- Never delete rows. Schema changes are additive, go through a migration file with a rollback, and are tested in a transaction first.
- Endpoints have side effects (certificate downloads increment counters; some actions send email). Don't "just try" them against production.
- Club member and executive contact details are public **on purpose** (students contact them).

---

## Documentation

- [BUGS.md](BUGS.md): full bug and risk audit with a live checklist (fixed / open / needs a decision).
- [FEATURES.md](FEATURES.md): feature plan and progress.
- [CONTRIBUTING.md](CONTRIBUTING.md): contribution guide.

---

<p align="center"><sub>© 2026 Technova, SSCSE, Sharda University. Built by the Technova development team.</sub></p>
