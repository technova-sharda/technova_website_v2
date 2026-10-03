# Technova Admin Panel: Feature Plan

**Date:** 2 Oct 2026 · Companion to [BUGS.md](BUGS.md). Numbers below come from the live database as of today (read-only checks).

**Ground rule for everything in this plan:** this is real student data.
- Every database change proposed here is **additive only**: new tables, columns, views or roles. Nothing edits or deletes existing rows.
- Nothing is applied without your explicit OK, a backup taken first, and a single transaction.

---

## 1. Where the admin panel is today

| Sidebar item | What it does | Gaps |
|---|---|---|
| Overview (`/admin/dashboard`) | Basic counts (clubs, registrations, finances) | System status is **hard-coded** "All Systems Operational" (BUGS U4) |
| Events | Create/edit events, registrations table, certificates, feedback | No bulk attendance, waitlist or registration deadline |
| Forms | Form builder, responses, evaluation | — |
| Resources | Approve/delete resources | — |
| Hackathon Portal | Separate light-themed portal | — |
| Settings | Sponsorship income/expense ledger | — |
| *(missing)* | **Clubs and members** | Members can't be managed from the panel. Photos need a file added to `public/assets/team/` **plus** a code edit (`lib/constants/team-photos.ts`); bios and order are hard-coded in `app/(public)/leadership/page.tsx` |
| *(missing)* | **Data insights** | Every "how many…?" question needs someone with database access |

---

## 2. Proposed sidebar

```
OVERVIEW
  Dashboard              (real stats + real system health)
MANAGE
  Events
  Clubs                  ★ new: clubs, members, photos, club admins
  People                 ★ new: student directory
  Certificates           ★ new: all events in one place
  Forms
  Resources
INSIGHTS
  Analytics              ★ new: ready-made charts (no AI)
  Ask Technova (AI)      ★ new: ask in plain English, get answers + charts
COMMUNICATE
  Emails                 ★ new: compose, audiences, delivery tracking
SYSTEM
  Access & Roles         ★ new
  Audit Log              ★ new
  Settings
  Hackathon Portal
```

---

## 3. Before building anything

Both headline features expose more data (photos, members, analytics), so first close the holes from BUGS.md:

| From BUGS.md | Why it blocks these features |
|---|---|
| **S1** open database rules | The AI analyst and clubs manager add more data paths; the base must be locked first |
| **S2/S3** actions without login checks | New admin actions must follow the right pattern from day one |
| **S8** club members' phone/email leak | The Clubs manager touches exactly this data |

Estimated ½–1 day, done as described in BUGS.md (backup, your approval, one transaction).

---

## 4. Feature A: Clubs manager ★

**Goal:** manage all **9 clubs and 60 members** from the admin panel, including photos, roles, bios, order and contact details, with no code changes and no copying files into folders.

### 4.1 Screens

**`/admin/clubs`**: a grid of clubs showing logo, member count, events this semester and when it was last updated.

**`/admin/clubs/[id]`** has four tabs: **Members · Profile · Events · Admins**

```
Clubs › GitHub Club                          [+ Add member] [Import CSV] [New academic year]
┌ Members (8) ────────────────────────────────────────────────────────────────────────┐
│ ⠿  [photo]  Aarav Sharma      President        Public ●   2026–27   ✎   ⋯           │
│ ⠿  [photo]  Meera Iyer        Vice President   Public ●   2026–27   ✎   ⋯           │
│ ⠿  [ + ]    Rohan Gupta       Core Member      Hidden ○   2026–27   ✎   ⋯   ← no photo │
└───────────────────────────────────────────────────────────────────────────────────────┘
  ⠿ = drag to reorder (this is the order on the public site)
```

**Member editor (side drawer):**

```
┌ Edit member ─────────────────────────────┐
│  [  photo  ]  Upload · drag to crop ⬚   │
│  Name        [ Aarav Sharma            ] │
│  Role        [ President             ▾ ] │  preset roles + custom
│  Email  🔒   [ …@ug.sharda.ac.in       ] │  admin-only, never public
│  Phone  🔒   [ +91 …                   ] │  admin-only, never public
│  LinkedIn    [ linkedin.com/in/…       ] │
│  GitHub      [ github.com/…            ] │
│  Bio         [ one line for the card   ] │
│  Tenure      [ 2026–27 ▾ ]   Active ☑    │
│  Show on public site ☑   Pin position [3]│
│                       [Cancel]  [Save]   │
└──────────────────────────────────────────┘
```

- **Profile tab:** logo upload, description, Instagram/LinkedIn, contact email.
- **Events tab:** this club's events with registration and turnout numbers.
- **Admins tab:** choose which accounts can manage **only this club**. This uses the existing but unused `admin_roles` table (`user_id, club_id, role`).
- **New academic year:** marks the current team as alumni, then carries forward people who continue in new roles. Old teams stay as history.
- **Import CSV:** name, email, phone, role. Shows a preview with duplicate warnings before saving.

### 4.2 Photos, done properly
1. Upload JPG/PNG/WebP (max 8 MB). Crop to a square in the browser, like the profile-photo crop on Instagram.
2. The server converts it with `sharp`:
   - output is 600×600 WebP, typically 40–80 KB instead of 3 MB;
   - EXIF metadata is stripped, which removes GPS location from phone photos.
3. It's saved to a public storage bucket `club-media/members/<member_id>.webp`, and `photo_url` is set on the member.
4. **One-time move of existing photos:** a script uploads `public/assets/team/**` and fills in `photo_url` using the current name mapping. It does a **dry run** first and shows a "matched / unmatched" list for your approval. This also fixes the bug where two different "Dushyant"s matched the same photo.

### 4.3 Public site changes
- `/leadership` and `/clubs/[slug]` read members, photos, bios and order **from the database**. This removes `lib/constants/team-photos.ts`, `TEAM_METADATA` and `PINNED_POSITIONS` (today's hand-edits for your card at #3 and Jayant Sekhar's photo become admin-panel actions).
- These pages become server-rendered and cached, refreshing when an admin saves. That makes them faster (BUGS P2).
- Public queries select **only public columns**, so phone and email never leave the server (fixes BUGS S8).
- The leadership mentors (VC, Dean, HOD and others) move into the same system, via the Site content manager (§6).

### 4.4 Database changes (additive; not applied)
```sql
ALTER TABLE public.club_members
  ADD COLUMN photo_url      text,
  ADD COLUMN bio            text,
  ADD COLUMN display_order  int     NOT NULL DEFAULT 0,
  ADD COLUMN is_active      boolean NOT NULL DEFAULT true,
  ADD COLUMN show_on_site   boolean NOT NULL DEFAULT true,
  ADD COLUMN tenure         text,          -- '2026-27'
  ADD COLUMN github_url     text,
  ADD COLUMN instagram_url  text,
  ADD COLUMN updated_at     timestamptz DEFAULT now(),
  ADD COLUMN updated_by     uuid;
-- + public storage bucket 'club-media'
-- + admin_roles starts being used for club admins (table already exists, 0 rows)
```

### 4.5 Permissions
| Who | Can |
|---|---|
| super_admin | Everything, all clubs |
| Club admin (`admin_roles.club_id`) | Their own club's members, photos and profile only |
| Public visitors | Name, role, photo, bio and social links of members marked "show on site" |

Every change is written to the Audit Log (§6).

**Effort:** about 4–6 days, plus ½ day for the photo migration.

---

## 5. Feature B: Ask Technova (AI data analyst) ★

**Goal:** an admin types a question in plain English and gets a **clear answer with animated charts**, using live data on events, registrations, attendance, feedback, XP, certificates, clubs and the hackathon.

### 5.1 What it would look like (real Start2Code numbers)

**Question:** *"How many people joined Start2Code?"*

```
Insights › Ask Technova
┌──────────────────────────────────────────────────────────────────────┐
│ 🔎  How many people joined Start2Code?                     [Ask ⏎] │
└──────────────────────────────────────────────────────────────────────┘
  ✓ Found the event   ✓ Counted registrations   ✓ Split by year & course

  171 students registered for Start2Code (19–20 Sep, GitHub Club). Most
  signed up in two bursts: 70 on 16 Sep and 56 on 18 Sep. About 3 in 4
  were first-years, mainly from CSE and CSE-AIML.

  ┌──────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────────┐
  │   171    │ │     0  ⚠     │ │    75%     │ │     74%      │
  │registered│ │marked attended│ │ 1st-years  │ │ CSE + AIML   │
  └──────────┘ └──────────────┘ └────────────┘ └──────────────┘
   (numbers count up)

  Registrations per day           Year              Course
  ▁▇▂▆▃▁  (bars grow in)          ◔ donut           ▇▇▇▇▇▇ CSE 76
  15 16 17 18 19 20 Sep           1st 128            ▇▇▇▇  AIML 51
  4  70 14 56 21  6               2nd 37 · 3rd 5     ▇ BCA 11 · DS 11 · CS 9 · other 13

  ⚠ Data note: attendance isn't recorded for this online event (0 of 171
    marked), so turnout can't be calculated. → Bulk attendance (§6) fixes this.

  ▸ How we got this (3 database queries)     [CSV] [PNG] [📌 Pin to dashboard]
  Follow-ups: · Compare with other GitHub Club events · Who didn't get a certificate?
              · Which courses should we target next time?
```

Other questions it should handle:
- "Turnout of the last 5 events, as a chart"
- "Which club had the most registrations this semester?"
- "Average feedback rating per event"
- "How many first-years attended at least 2 events?"
- "XP leaderboard movement this month"
- "Hackathon: teams per department, and food scans per hour"

### 5.2 How it works

```
Admin types a question
        │
        ▼
POST /api/admin/insights    super_admin only · rate-limited · every question logged
        │   streams progress ("Counting registrations…") to the screen
        ▼
LLM via NVIDIA API ──► tool run_sql("SELECT …") ──► Postgres as role analytics_ro
 (model in env)  ◄── rows (max 500) ◄──────────  read-only · 5 s timeout ·
        │   repeats 1–4×                          analytics views only
        ▼
tool present_answer({ summary, kpis, charts, notes })
        │   charts point at query results by id; the server fills in the
        │   real numbers, so a chart can never show a number the DB didn't return
        ▼
Screen: summary · animated KPI cards · Recharts charts · "How we got this"
```

### 5.3 Safety design (non-negotiable: it's real student data)

1. **Read-only at the database level, not just "please don't write".**
   - The AI's queries run as a separate Postgres role, `analytics_ro`. It can `SELECT` from the `analytics` views and nothing else: no access to `public`, `next_auth`, `storage` or `auth`.
   - The role has `default_transaction_read_only = on` and `statement_timeout = 5s`.
   - Even if the AI wrote `DELETE`, Postgres refuses it. The service-role key is **never** used for AI queries.
2. **Curated views, not raw tables.** Emails, phone numbers, system IDs, QR tokens, magic tokens, sessions and payment IDs are **excluded entirely**. Students appear only as anonymous IDs unless you decide names are OK (§8).
3. **Limits:** one statement per query, results capped at 500 rows, and a maximum of 6 steps per question.
4. **Who can use it:** super_admins first. Every question is logged in `ai_query_log`: who asked, the question, the SQL, rows returned and time taken.
5. **Usage caps:** a per-admin daily question limit, kept well under NVIDIA's free rate limit, which is shared by all admins (§5.7). It stops politely when a cap is reached.
6. **Numbers come from the database, not the model.** KPIs and charts reference query results; the "How we got this" panel shows every query.
7. **Privacy:** the question and the (aggregated) query results go to **NVIDIA's hosted API**, a third party.
   - Before launch, read NVIDIA's API terms on how prompts are used and retained, check the university's data policy, and get faculty sign-off if needed.
   - This is why the views exclude all contact details.
8. **Untrusted text:** feedback comments could contain "instructions". The AI can only read, and its output is shown as plain text, so the worst case is a wrong answer, never a data change.

### 5.4 Data layer: `analytics` schema (views, additive)

| View | Columns (no contact info) | Built from |
|---|---|---|
| `analytics.events` | id, title, club, type, difficulty, is_virtual, start/end (IST), capacity, status | events, clubs |
| `analytics.registrations` | event_id, student_id, registered_at (IST), attended, payment_status, course, year, section | registrations + users |
| `analytics.students` | student_id, course, year, xp_points, joined_at | next_auth.users |
| `analytics.checkins` | event_id, student_id, checkin_date (IST) | daily_checkins |
| `analytics.feedback` | event_id, rating, submitted_at (+ comments, if you approve) | feedback_responses |
| `analytics.xp` | student_id, event_id, xp_amount, reason, awarded_at | xp_awards |
| `analytics.certificates` | event_id, type, position_title, status, issued_at, downloads | certificates, certificate_positions |
| `analytics.clubs` | club, member counts by role | clubs, club_members |
| `analytics.hackathon_*` | teams, participants, gate and food scan stats (counts) | hackathon tables |
| **Ready-made metric views** (make the AI more accurate) | | |
| `analytics.event_summary` | one row per event: registrations, attended, turnout %, avg rating, feedback count, certificates sent | the views above |
| `analytics.event_daily` | registrations per event per day (IST) | registrations |
| `analytics.event_audience` | counts per event by year, course and section | registrations + users |

All times are converted to IST inside the views, which also avoids BUGS D5 for analytics. The same views power the **non-AI Analytics dashboard**.

The ready-made metric views matter because free open models write complex SQL less reliably. With them, most questions ("how many joined X", "turnout of last 5 events") become a one-line `SELECT … FROM analytics.event_summary WHERE …` instead of a 4-table join.

### 5.5 Implementation notes: NVIDIA API (for whoever builds it)
- **API:** NVIDIA's hosted models (build.nvidia.com) use an **OpenAI-compatible** endpoint: base URL `https://integrate.api.nvidia.com/v1`, auth via `Authorization: Bearer <key>`. Use the standard `openai` npm package with `baseURL` set; no NVIDIA-specific SDK is needed.
- **Keys and config:**
  - `NVIDIA_API_KEY` is a **server-only** env var, never `NEXT_PUBLIC_`.
  - The model name lives in `NVIDIA_MODEL`, and a backup model in `NVIDIA_FALLBACK_MODEL`, so you can change models without a code change.
- **One wrapper file:** all AI calls go through `lib/ai/provider.ts`, so switching to another model or provider later is a config change, not a rewrite.
- **Choosing the model:**
  - Only consider large instruction models whose model card says they support **tool/function calling**. Families like Llama 3.3 70B, Nemotron, Qwen and gpt-oss are typical; check what's listed today.
  - Then test 2–3 candidates on a **fixed set of ~20 real questions with known answers** (e.g. Start2Code registrations = 171) and keep the most accurate.
  - Re-run that test whenever you change models.
- **Loop:** OpenAI-style chat completions with two `tools`, at most 6 rounds per question, with each step streamed to the screen:
  - `run_sql({ sql, purpose })` returns rows plus a `resultId`;
  - `present_answer({...})` returns the final answer.
- **Accuracy safeguards for open models**, which make more SQL mistakes than top paid models:
  1. **Ready-made metric views** (§5.4), so most answers need only a simple `SELECT`.
  2. **10–15 worked examples** (question → SQL) in the system prompt, plus a glossary: "attended" means scanned or marked; all times are IST; the academic year runs Jul–Jun.
  3. **SQL guard:** parse the SQL (e.g. `node-sql-parser`) and accept only a single `SELECT` on `analytics.*` before running it. The database role is still the real wall.
  4. **Self-correction:** if Postgres returns an error, send the error back to the model to fix the query, at most twice.
  5. **Low temperature** (0–0.2) so queries are consistent.
  6. **Validate `present_answer` with Zod.** If it's malformed, show the raw result table and a plain-text summary instead of an error.
- **Route:** `app/api/admin/insights/route.ts` with `export const maxDuration = 60`.
- **Answer schema** (sketch):
  ```ts
  present_answer: {
    summary: string                       // 2–4 plain sentences, the answer first
    kpis:    { label, resultId, column, format: "number"|"percent"|"inr" }[]   // ≤ 4
    charts:  { type: "bar"|"hbar"|"line"|"area"|"donut"|"stacked"|"funnel"|"table",
               title, resultId, x, y[] }[]                                     // ≤ 4
    notes:   string[]                     // data caveats, e.g. "attendance not recorded"
    followUps: string[]                   // 2–3 suggested next questions
  }
  ```

### 5.6 Charts that are easy to understand
- **Recharts** is already installed and used in `components/admin/form-responses-charts.tsx`. **framer-motion** is also installed: use the same count-up numbers as the new event page, staggered card entrances, and bars and lines that grow in. Respect "reduce motion".
- **Chart types:** KPI cards, bars (compare), horizontal bars (rankings), line/area (trends over time), donut (shares, max 6 slices), stacked bars (event vs event), **funnel** (registered → attended → feedback → certificate), and tables (top-N).
- **Readability rules**, enforced in the system prompt:
  - the answer comes first, in one sentence;
  - at most 4 charts;
  - human labels ("1st year", "16 Sep");
  - always state data caveats.
- **On every answer:** Export CSV · Download PNG · Copy summary · **Pin to Analytics dashboard** · Ask a follow-up.

### 5.7 Cost & limits (NVIDIA free tier)
- **Cost: $0.** A free NVIDIA Developer Program key, no credit card.
- **Rate limit:** about **40 requests per minute**. NVIDIA says limits vary by model and doesn't publish exact numbers. The limit is **shared by all admins**:
  - one question uses 2–6 requests, so roughly 7–20 questions per minute in total, which is plenty for a few admins;
  - on HTTP 429, back off and show "Busy, retrying in 10 s".
- **Prototyping vs production:** NVIDIA presents the free hosted endpoints as being for **prototyping/development**; production use is meant to go through a paid or licensed path. For an internal tool used by a handful of admins, confirm that's acceptable, and keep a paid option in mind as a backup.
- **Reliability:** free endpoints can be slow at peak times, and models get added or retired. Hence the model name in an env var plus a configured fallback model (§5.5).
- The **non-AI Analytics dashboard** has no AI dependency at all and answers the common questions instantly. The AI is for the ad-hoc ones.

### 5.8 Build order
| Step | What | Effort |
|---|---|---|
| 1 | `analytics` views + `analytics_ro` role (additive, your approval) | ~2 days |
| 2 | **Analytics dashboard** (no AI) on those views: KPIs, trends, per-club, per-event funnel | ~3 days |
| 3 | **Ask Technova MVP**: question → answer + charts, streaming, logging, caps, plus the 20-question model test | ~5–6 days |
| 4 | Polish: pin to dashboard, saved questions, follow-ups, weekly AI digest email to the core team | ~3 days |

---

## 6. More features worth adding

| Area | Feature | What it does | Why | Effort | Priority |
|---|---|---|---|---|---|
| People | **People directory** | Search any student: their events (registered/attended), XP history, certificates, feedback. Merge duplicate accounts. Export | "Did X attend?" currently needs database access | 3–4 d | High |
| People | **Access & roles** | Add/remove admins from the UI, club-level admins, instant revoke, role history | Replaces hard-coded `ADMIN_EMAILS` (BUGS S4) | 2–3 d | High |
| Events | **Bulk attendance** | Tick students, or upload a Google Meet/Zoom attendance CSV → marked attended → XP + certificate eligibility | Start2Code: 0 of 171 recorded (BUGS D8) | 2 d | High |
| Events | **Event report for HOD/Dean (PDF)** | One click → branded PDF with registrations, turnout, department/year split, feedback, photos and certificates; AI writes the summary paragraph | Faculty reports are done by hand today | 3 d | High |
| Events | **Registration controls** | Deadline, close/reopen, **waitlist** with auto-promote | Prevents overbooking and late signups (BUGS R1/R2) | 3 d | Medium |
| Events | Event templates & duplicate | "Create Start2Code 2027 from 2026" | Saves setup time | 1 d | Medium |
| Events | Volunteers & duty roster | Assign volunteers to slots/desks per event | Coordination is on WhatsApp today | 3 d | Low |
| Communicate | **Email center** | Templates, audiences (registered / attended / not attended / year / course), schedule, **send test to me**, delivery status per student, **retry failed** | Bulk sends partially fail silently (BUGS C2) | 4–5 d | Medium-High |
| Communicate | Working reminders + site banner | Cron reminders (BUGS D3) + an announcement bar on the public site | Reminders have never gone out | 1 d | High |
| Certificates | **Certificates hub** | All events in one place, failed emails, bulk resend, verification stats, **send test certificate to myself** before bulk | Would have caught the broken Top 1 certificate early | 2–3 d | Medium |
| Insights | **Analytics dashboard** | Ready-made charts: semester KPIs, turnout trend, per-club comparison, per-event funnel | Free, instant, and the base for the AI | (§5.8) | High |
| Insights | **Feedback insights (AI)** | After feedback closes, summarise comments into top themes, praise and complaints per event | 228 responses, nobody reads them all | 2 d | Medium |
| Platform | **System health (real)** | Last cron run, emails sent/failed, error count, storage and DB size | Replaces the fake "All Systems Operational" (BUGS U4) | 1–2 d | High |
| Platform | **Audit log** | Who did what and when (cancel, revoke, delete, send, role change, member edits) | Accountability once more people are admins | 2 d | High |
| Platform | **Media library** | All uploaded images in one place; auto-resize; reuse banners | 3–5 MB phone photos slow the site (BUGS P4) | 2–3 d | Medium |
| Platform | **Site content manager** | Edit homepage sections, partners/sponsors and leadership mentors (bio, photo, order) without code | Jayant Sekhar's photo needed a code change today | 3 d | Medium |
| Platform | Finance upgrade | Budget vs actual per event, receipts upload, export for faculty | Ledger exists in Settings but is minimal | 2–3 d | Low |
| Platform | Moderation queue | Community posts/comments and Buddy Finder reports in one queue | Moderation is hidden today | 2 d | Low |

---

## 7. Roadmap

| Phase | Contents | Time (one developer) |
|---|---|---|
| **0: Safety first** | BUGS.md S1, S2, S3, S8 | ½–1 day |
| **1: Clubs & people** | Clubs manager · Access & roles · Audit log | ~1.5–2 weeks |
| **2: Event operations** | Bulk attendance · Event report PDF · Registration controls · Real system health · Reminders | ~1–1.5 weeks |
| **3: Insights** | Analytics views + read-only role · Analytics dashboard · Ask Technova MVP · Feedback insights | ~2 weeks |
| **4: Communication & content** | Email center · Certificates hub · Media library · Site content manager | ~2 weeks |

---

## 8. Decisions needed from you

1. **AI and student data:** is it OK to send aggregated, de-identified results to **NVIDIA's hosted API**? Does faculty need to approve? Should **names** be allowed (e.g. "top 10 students by XP"), or only anonymous IDs and counts?
2. **Who can use Ask Technova:** super_admins only, or club admins too (seeing only their club's data)?
3. **Free-tier terms:** are you OK running an internal admin tool on NVIDIA's free (prototyping) endpoint, with a paid option as backup if limits or terms become a problem?
4. **Club admins:** should each club's account manage only its own club?
5. **Feedback comments in AI:** include the free-text comments (richer answers) or ratings only (safer)?
