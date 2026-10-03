# Technova Website: Bug & Risk Audit

**Date:** 2 Oct 2026 · **Scope:** whole repo (243 TS/TSX files, ~52k lines), the live Supabase database (read-only checks), and the certificate system built today.

**How to read this**
- **Severity:** 🔴 Critical (fix today) · 🟠 High (this week) · 🟡 Medium · ⚪ Low
- **Status:**
  - **Verified (DB):** confirmed against the live database. All checks were read-only; nothing was modified.
  - **Verified (code):** confirmed by reading the code.
  - **Likely:** strong evidence, but not reproduced.
- File references are `path:line` at the time of writing.

---

## ✅ Fix checklist: status as of 3 Oct 2026

**Verification:**
- 0 TypeScript errors (was 15).
- The production build passes, with type errors now enforced (`ignoreBuildErrors` removed).
- 0 lint errors in the 72 changed files.
- Offline tests of fonts, IST dates, rate limits and URL validation pass. The referrer lookup was checked against the live database with SELECT queries only.
- **No database changes, except the one column you approved** (`events.registrations_closed`), which was backed up first and verified.
- **Nothing is deployed yet.** Production still runs the old code.

### Fixed in code (21)
- [x] **S2** Unauthenticated write actions:
  - sponsorships are super-admin only;
  - reminders moved out of public actions;
  - `processMissedReferrals` is super-admin only;
  - `processReferral` is server-only and checks the student really registered.
- [x] **S3** Evaluator tokens and applicant answers need an admin or a matching evaluator token. *(Correction: the gate-log functions were already protected; my audit missed `checkHackathonRole`.)*
- [x] **S5** Razorpay webhook: constant-time signature check, amount/currency check, retries ignored. Order amounts are rounded to whole paise.
- [x] **S6** The events list sends only the columns it shows. Meeting links go only to registered students and admins (page and data layer).
- [x] **S7** Profile links accept only http/https URLs.
- [x] **D1** Referrer lookup uses an ID-range query (it used to miss users past 1,000).
- [x] **D2** Buddy Finder pages past 1,000 profiles.
- [x] **D4** The force-refresh leaderboard button works.
- [x] **D5** IST everywhere: ticket email, CSV exports, check-in day keys, event day counts, attendees view, scanner "today", and the midnight "24:xx" display.
- [x] **D6** Atomic XP updates (compare-and-swap) in all 6 places.
- [x] **D7** Gate-log stats, overdue list and export page past 1,000 rows.
- [x] **D9** Removed the dead call to a missing database function.
- [x] **R2** The server enforces "registration open". Plus the new **Stop Registrations** button.
- [x] **R4** Students can't cancel after attending.
- [x] **C2** Certificate, blast and reminder emails use batch sending with real success/failure counts.
- [x] **C3** Certificate downloads allow 60/min per IP (was 5), and every route has its own rate-limit counter.
- [x] **C4** The template and fonts are downloaded once per batch, not once per student.
- [x] **P6** Paging fixed everywhere it was missing: admin Registrations page, participants, leaderboard, buddies, gate logs, referrals.
- [x] **P7** `maxDuration` set on certificate, blast and cron routes.
- [x] **U4** The dashboard shows real health checks, not hard-coded "All Systems Operational".
- [x] **H1** 0 type errors, the build now checks types, and there's an `npm run typecheck` script.

### New bugs found and fixed today (10)
- [x] **E1** Resend returns errors instead of throwing. All 16 email call sites counted failures as "sent".
- [x] **C8** **Dancing Script and Cormorant Garamond crashed certificate generation.** The Start2Code template uses Dancing Script. Each font now has a verified embedding mode, Cormorant uses new files, and a fallback chain means a certificate always generates.
- [x] **C9** Gaps and collisions in script-font names ("Studen t", "Pr") from ligatures and missing kerning. The PDF now lays text out properly, and the editor preview matches.
- [x] **S9** The attendance kiosk email lookup accepted wildcards (`%@gmail.com` returned a stranger's details). It now requires an exact match, updates need the email, and it's rate-limited.
- [x] **S10** Buddy Finder returned every student's email to logged-out visitors. It now requires login and shows a sign-in prompt.
- [x] **D11** The admin Registrations page was already missing rows (1,002 registrations against the 1,000 cap).
- [x] **D12** "Undo check-in" never took the XP back, so re-scanning gave double XP.
- [x] **D13** Weekly/monthly/yearly leaderboards ignored check-in XP, about 97% of all XP. This month showed 11 students and 170 XP; the correct figures are 21 and 1,070.
- [x] **D14** XP-history inserts always failed (bug reports; the feedback award's first attempt).
- [x] **D15** The feedback XP award could be given twice under a race. It now claims the award atomically.

### Partly fixed (6)
- [~] **S8** Phone numbers are no longer sent. Emails stay, because they're shown on purpose. The open database rule is still pending (see below).
- [~] **R3** Unpaid registrations can't check in, and no payment order is created without a registration. Still missing: the ticket after payment, and retrying a failed payment.
- [~] **P1** Each route has its own counter, but limits are still in memory (no Redis).
- [~] **P8** `select('*')` removed where data leaked; still used elsewhere.
- [~] **U1** The admin Registrations table is now dark. The public event page's white cards are untouched, and the hackathon portal is light by design.
- [~] **H3** Debug logs with user IDs removed from the referral and registration paths.

### ⏳ Needs your approval: database changes, NOT applied (5)
- [ ] **S1 / C6** Lock down the open access rules (SQL in section S1). **Highest priority.**
- [ ] **S8** Drop the "Public read members" rule.
- [ ] **R1** A SQL function so capacity can't be overbooked.
- [ ] **P5** Add an index on `registrations(event_id)`; drop the duplicate indexes.
- [ ] **D10** 413 users' XP totals don't match their award history. Needs a decision on how to reconcile.

### 👤 Needs your action or decision (5)
- [ ] **C1** Deploy. Ideally after AI KickStart ends (4 Oct, 11 PM IST), or before 8 PM today if you need Stop Registrations live.
- [ ] **D3** Reminders need a cron every 30–60 min (Vercel Pro or an external cron) plus `CRON_SECRET`.
- [ ] **S4** Admin roles are hard-coded.
- [ ] **H5** One-off scripts in the repo root.
- [ ] `public/assets/team/datapool/dushyant.png` was deleted, but the photo mapping still points to it. `ko.png` is unused.

### 🔜 Still to do (13)
- [ ] **NEW:** `app/(public)/clubs/[slug]/page.tsx:406-410` calls `useState`/`useEffect` conditionally (rules-of-hooks), which **can crash club pages**. Found, not yet fixed.
- [ ] **D8** Bulk attendance (feature)
- [ ] **C5** Cache generated PDFs
- [ ] **P2** Server-render public pages
- [ ] **P3** Caching
- [ ] **P4** Resize images on upload
- [ ] **U2** Replace `alert()`/`confirm()`
- [ ] **U3** Loading states
- [ ] **H2** React 19
- [ ] **H4** `@ts-ignore` / `as any`
- [ ] **H6** Exported `getSupabase` in `hackathon.ts`
- [ ] **H7** Tests and monitoring
- [ ] Kiosk email one-time code, and 61 cosmetic lint errors in untouched files

---

## Fix-first summary

| # | Issue | Sev | Status |
|---|---|---|---|
| S1 | Database rules let **anyone with the public browser key** read and write certificates, XP, feedback, check-ins, evaluator tokens, and attendee phone numbers and QR codes | 🔴 | Verified (DB) |
| S2 | Server actions with **no login check** that write data: add/delete sponsorship money, trigger mass reminder emails, farm referral XP, edit attendee details | 🔴 | Verified (code) |
| S3 | Server actions with no login check that **leak data**: evaluator magic tokens, every form answer with names/emails, attendee lookup | 🔴 | Verified (code) |
| S8 | Club members' **phone numbers and emails** are sent to every visitor of `/leadership` and the club pages | 🟠 | Verified (code+DB) |
| D1 | **Referrals silently fail for ~27% of users** (user list capped at 1000 rows; you have 1,368) | 🟠 | Verified (DB+code) |
| D3 | **Event reminder emails have never been sent** (no cron schedule; 0 of 19 events) | 🟠 | Verified (DB) |
| C3 | Certificate downloads are rate-limited to **5/min per IP**; on campus Wi-Fi the whole campus shares one IP | 🟠 | Verified (code) |
| C2 | Bulk certificate/email sends run one by one and can hit Resend's limit and the function time limit | 🟠 | Likely |
| D2 | Buddy Finder can't find ~150 of 1,151 profiles (same 1000-row cap) | 🟠 | Verified (DB+code) |
| R3 | Paid-event flow is broken end to end (no QR ticket, can't retry payment, scanner ignores payment) | 🟠 | Verified (code) |
| P2 | Public pages load data in the browser after render: slow, never CDN-cached, not indexed by Google | 🟡 | Verified (code) |

---

## 1. Security

### 🔴 S1. Row-level security is effectively off for many tables. Verified (DB)

Policies named "Service role full access…" were created with `USING (true)` but **without `TO service_role`**, so they apply to the `anon` and `authenticated` roles too. The **anon key ships in every visitor's browser** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`).

Test run with only the anon key (read-only counts):

| Table | What the public key can do | Rows exposed |
|---|---|---|
| `certificates` | read, **update, insert, delete** | 3 |
| `xp_awards` | read, **delete** | 189 |
| `feedback_responses` | read/write | 228 |
| `form_evaluators` | read, incl. **`magic_token`** | 15 |
| `event_attendees` | read **and update**; includes **`mobile`, `qr_code`** | 13 |
| `daily_checkins` | read/write | 527 |
| also: `certificate_templates`, `certificate_positions`, `event_feedback_forms`, `feedback_questions`, `form_evaluations`, `event_attendance_scans`, `certificate_analytics` | | |

**What an attacker can do:**
- Insert a certificate for anyone, and it shows as **valid** on the verify page.
- Un-revoke a revoked certificate.
- Delete everyone's XP.
- Read every student's phone number and entry QR code.
- Steal an evaluator token and submit scores as that evaluator.

**Fix (safe for the app):** the app's server code uses the **service-role key, which bypasses RLS anyway**, so these policies only ever helped attackers. I checked every use of the anon key; none touches a table on this list:
- **Client:** `app/(admin)/admin/hackathon/scan/page.tsx` and `app/(hackathon-portal)/hackathon-portal/scan/client.tsx` read only `hackathon_settings`, which keeps its own read policy.
- **Server:** `lib/actions/projects.ts`, `resources.ts` and `community.ts` use only `projects`, `resources`, `community_posts` and `community_comments`.

```sql
DROP POLICY "Service role full access to certificate_positions" ON public.certificate_positions;
DROP POLICY "Service role full access to certificate_templates" ON public.certificate_templates;
DROP POLICY "Service role full access to certificates"          ON public.certificates;
DROP POLICY "Service role full access to daily_checkins"        ON public.daily_checkins;
DROP POLICY "Service role full access to event_feedback_forms"  ON public.event_feedback_forms;
DROP POLICY "Service role full access to feedback_questions"    ON public.feedback_questions;
DROP POLICY "Service role full access to feedback_responses"    ON public.feedback_responses;
DROP POLICY "Service role full access to xp_awards"             ON public.xp_awards;
DROP POLICY "Evaluators can manage own evaluations"             ON public.form_evaluations;
DROP POLICY "Public can read form_evaluators by token"          ON public.form_evaluators;
DROP POLICY "Allow read event_attendees"                        ON public.event_attendees;
DROP POLICY "Allow public update event_attendees"               ON public.event_attendees;
DROP POLICY "Allow read event_attendance_scans"                 ON public.event_attendance_scans;
DROP POLICY "Allow public insert event_attendance_scans"        ON public.event_attendance_scans;
DROP POLICY "Anyone can insert analytics"                       ON public.certificate_analytics;
```

Then rotate the evaluator magic tokens, since they may already have been read:
`UPDATE public.form_evaluators SET magic_token = encode(gen_random_bytes(16),'hex');`

> The migration I wrote today (`20261002_certificate_positions.sql`) copied the same bad pattern from `0019_add_certificate_system.sql`. Going forward, write `CREATE POLICY … TO service_role`, or skip the policy entirely, since service role doesn't need one.

### 🔴 S2. Server actions that write data with no auth check. Verified (code)

Every exported function in a `'use server'` file is a **public HTTP endpoint**, even if the page that uses it is admin-only. Protecting the API route in front of it doesn't help, because the action can be called directly.

| Action | File | What anyone can do |
|---|---|---|
| `addSponsorship`, `deleteSponsorship` | `lib/actions/sponsorships.ts:13`, `:40` | Add fake sponsorship money or delete real records |
| `sendEventReminders` | `lib/actions/notifications.ts:126` | Trigger reminder emails to every participant of upcoming events (spam; burns Resend quota) |
| `processMissedReferrals` | `lib/actions/fix-referrals.ts:19` | Run the referral backfill (awards XP) |
| `processReferral(code, eventId, refereeId)` | `lib/actions/referrals.ts:73` | Call it with random `refereeId`s and award **unlimited XP** to any referrer. Nothing checks that the referee actually registered |
| `updateAttendeeDetails`, `registerNewAttendee` | `lib/actions/hackathon.ts:2666`, `:2684` | Edit any attendee's details by ID; create attendees |

**Fix:**
- Add `requireAdmin()` (or ownership checks) at the top of each.
- Move `processReferral` and `processMissedReferrals` into a non-exported module or `lib/server/*`, so they aren't exposed as actions.
- `processReferral` should verify the registration exists for `(refereeId, eventId)`.

### 🔴 S3. Server actions that leak data with no auth check. Verified (code)

| Action | File | Leak |
|---|---|---|
| `getFormEvaluators(formId)` | `lib/actions/form-evaluation-actions.ts:64` | `select("*")` includes **`magic_token`**, which lets anyone impersonate an evaluator |
| `getFormCandidates(formId)` | `…/form-evaluation-actions.ts:422` | Every response and answer, plus applicants' name, email and system ID |
| `getEvaluationsByEvaluator(id)` | `…/form-evaluation-actions.ts:457` | Scores and remarks |
| `lookupAttendeeByEmail(email)` | `lib/actions/hackathon.ts:2651` | Name, system ID, section, department and college for any email |
| `getGateLogs`, `getOverdueParticipants` | `lib/actions/hackathon.ts:2911`, `:2857` | Who entered or left, and when |
| `getSupabase` (exported) | `lib/actions/hackathon.ts` | Helper exported from a `'use server'` file becomes an endpoint (useless, but shouldn't exist) |

**Fix:** auth or token checks in each. Return only the columns needed, never `select("*")` on tables with secrets.

### 🟠 S4. Admin roles are hard-coded and never refreshed. Verified (code)
- `lib/auth/role-utils.ts:2`: every email in `ADMIN_EMAILS` is **`super_admin`**, including a personal Gmail. The separate `admin` role is effectively unused, yet some actions accept `admin`.
- The role is computed **once at login** and stored in the JWT (`lib/auth/config.ts:58`). Removing someone from the list doesn't revoke access until their session expires.
- **Fix:** an `admins` table with roles managed from the admin UI, and a role re-check in `jwt()` on each refresh, or shorter session lifetimes.

### 🟠 S5. Razorpay webhook. Verified (code), `app/api/webhooks/razorpay/route.ts`
- The signature is compared with `!==` instead of `crypto.timingSafeEqual`.
- It doesn't check the **paid amount** against the event price.
- It matches the payment by storing the Razorpay `order_id` in `registrations.qr_token_id`, the same column the entry QR uses (see R3).

### 🟡 S6. Public event data over-fetch. Verified (code)
- `getPublicEvents` (`lib/actions/events.ts:338`) returns `select('*')` to every visitor, including **`meeting_link`** for online events, even for people who haven't registered.
- **Fix:** select only public columns, and serve `meeting_link` only to registered users.

### 🟠 S8. Club members' phone numbers and emails are public. Verified (code+DB)
`club_members` stores `phone` and `email` (60 members). They leak two ways:
- **In page data:** `getClubMembersByName`, `getClubWithMembers` and `getClubs` (`lib/actions/clubs.ts`) use `select('*')`, and their results go to public pages (`/leadership`, `/clubs/[slug]`). Every visitor downloads executives' phone numbers and emails; they're visible in the browser's network tab.
- **Through the public key:** the "Public read members" rule makes the same columns readable with the anon key.

**Fix:**
- Select only public columns (`id, club_id, name, role, linkedin_id` plus photo).
- Drop the public read rule. Club pages use the service-role key, so they keep working.
- Treat phone and email as admin-only fields (see FEATURES.md → Clubs manager).

### ⚪ S7. Profile links aren't validated. Verified (code)
- `github_url`, `linkedin_url` and the other profile links are stored as typed (`lib/actions/profile.ts:33`) and rendered as links (`components/buddy/BuddyCard.tsx:63`).
- App Router's React blocks `javascript:` links, but phishing URLs are allowed.
- **Fix:** validate `https://` and the expected domain on save.

---

## 2. Live data bugs (happening now)

### 🟠 D1. Referrals fail for ~27% of users. Verified (DB+code)
`lib/actions/referrals.ts:96` loads **all users** to find the referrer by ID prefix. Supabase returns at most **1000 rows** and you have **1,368 users**, so referrers outside the first 1000 get "Referrer not found". It's also slow, since every referred registration downloads the user table.
**Fix:** store the referral code in a column (or look it up in the `referrals` table, which has an index on `referral_code`) and query it directly.

### 🟠 D2. Buddy Finder misses ~150 people. Verified (DB+code)
`lib/actions/profile.ts:129` loads all `profiles` (1,151 rows) and filters in JavaScript, so the 1000-row cap drops the rest.
**Fix:** filter in SQL (`skills` with `ov`/`cs`, or full-text search) with pagination.

### 🟠 D3. Event reminders have never been sent. Verified (DB)
- `app/api/cron/event-reminders/route.ts` says it's "called every 30 minutes by Vercel Cron", but the repo has **no `vercel.json`** with a `crons` entry.
- All 19 events have `reminder_sent_at = NULL`.
- **Fix:** add `vercel.json` → `{"crons":[{"path":"/api/cron/event-reminders","schedule":"*/30 * * * *"}]}` and set `CRON_SECRET`. Note that Vercel Cron sends **GET**, so make sure the GET handler checks the secret too.

### 🟠 D4. "Force refresh leaderboard" always crashes. Verified (code)
`lib/actions/force-cache-refresh.ts:5` imports `getServerSession` from `next-auth`, which doesn't exist in Auth.js v5. The call throws, so the admin button never works. It also loads all users (1000 cap) to revalidate their tags.
**Fix:** use `auth()` from `@/lib/auth`, and use one shared tag instead of per-user tags.

### 🟡 D5. Times shown in UTC instead of IST. Verified (code)
The server runs in UTC, and these places format dates without `timeZone: 'Asia/Kolkata'`:
- `lib/actions/registrations.ts:135`: the **ticket email time is 5h30m off**.
- `lib/actions/forms.ts:584`, `lib/actions/hackathon.ts:1801`: CSV export timestamps.
- `lib/xp/award.ts:199`, `:284`: the daily check-in date uses `toISOString()` (UTC). **Check-ins between 00:00 and 05:30 IST count as the previous day**, which breaks overnight hackathons.
- `lib/xp/calculator.ts:90`, `:125`, `:154`: event "days" are computed in UTC.

**Fix:** the IST helpers already in `lib/utils.ts` (`getISTParts`, `formatDateShort`); use them everywhere.

### 🟡 D6. XP can be lost when updates happen at once. Verified (code)
XP is updated by "read the current value, add, write back" in `lib/xp/award.ts:124`, `:367`, `lib/xp/feedback-award.ts:85`, `lib/actions/bug-reports.ts:104`, `lib/actions/fix-referrals.ts:142` and `lib/actions/referrals.ts` (~line 185). Two updates at the same moment (scanner plus feedback, say) and one is lost.
**Fix:** a SQL function `UPDATE users SET xp_points = xp_points + $1` called via `.rpc()`. Better still, derive the total from `xp_awards`.

### 🟡 D7. Gate status breaks past 1000 logs. Verified (code)
`lib/actions/hackathon.ts:2827` loads all gate logs to work out who's inside. It's at 522 now; past 1000, participants' status goes wrong.
**Fix:** `DISTINCT ON (participant_id) … ORDER BY scanned_at DESC` in a view or RPC.

### 🟡 D8. Start2Code shows 0 of 171 attended. Verified (DB)
It's an online event, so nobody was ever marked attended. There's **no admin tool to mark attendance in bulk**, so certificate eligibility had to fall back to "all registered".
**Fix:** see feature F2.

### ⚪ D9. `incrementDownloadCount` calls a database function that doesn't exist. Verified (DB)
`lib/actions/certificates.ts`: the RPC `increment_download_count` isn't in the database, so the call always fails quietly. The download route counts on its own, so nothing visible breaks. Delete it.

---

## 3. Registration & payments

### 🟠 R1. Capacity can be overbooked. Verified (code)
`lib/actions/registrations.ts:53-61` counts registrations, then inserts them in a separate step. If two people register at the same moment, both pass the check.
**Fix:** do the capacity check and insert in one SQL function (`INSERT … WHERE (SELECT count(*) …) < capacity`) or with a row lock.

### 🟠 R2. The server doesn't check if registration is open. Verified (code)
`registerForEvent` doesn't check `event.status`, `start_time` or `end_time`. Anyone calling the action directly can register for drafts or for events that have already ended.

### 🟠 R3. Paid events are broken end to end. Verified (code). No paid events exist yet, so nobody has hit it
- `registrations.ts:64-74`: the payment registration is inserted as `pending`, with the **Razorpay order ID stored as the QR token**. No QR ticket is generated and no ticket email is sent.
- If the payment fails, the student is "Already Registered", **can't retry**, and the pending row still counts toward capacity.
- The referral isn't processed for paid events.
- `app/api/scan/route.ts:45` never checks `payment_status`, so a pending (unpaid) registration can be checked in.

**Fix:** a separate `payment_order_id` column. Generate the QR and send the ticket in the webhook on `payment.captured`. Expire pending registrations after 30 minutes.

### ⚪ R4. Cancelling after attending
A student can cancel their registration after attending (`registrations.ts:268`). Their XP, daily check-ins and certificates stay behind, but the registration disappears.

---

## 4. Certificates (built today): what's still open

| # | Issue | Sev | Status |
|---|---|---|---|
| C1 | Email download links use `NEXT_PUBLIC_APP_URL` (production). Until this code is deployed, students hit the **old** code, which printed the name over your Top 1 certificate. **Deploy before sending.** | 🟠 | Verified |
| C2 | `releaseCertificates` and `sendPositionCertificates` render and send emails **one at a time** in a single server action. Resend's default limit is about 2 requests/sec, and no `maxDuration` is set. With 171 students, some emails fail and show "email not sent" (resend works), or the function gets cut off mid-loop. **Fix:** `resend.batch.send` (100 per call), or queue with a status table. | 🟠 | Likely |
| C3 | `/api/certificate` allows **5 downloads per minute per IP** (`app/api/certificate/route.ts:14`). Campus Wi-Fi is one public IP, so after the blast most students get "Rate limit exceeded". The limiter is also shared across routes (see P1). | 🟠 | Verified |
| C4 | The ZIP download (`app/api/certificate/bulk/route.ts`) re-downloads the template and rebuilds **every** PDF in one request, which will time out on big events. | 🟡 | Likely |
| C5 | Every download regenerates the PDF from scratch (template fetch, fonts, QR). **Fix:** store the PDF the first time and serve it from storage. | 🟡 | Verified |
| C6 | Certificate tables are writable with the public key (**S1**): anyone can forge or un-revoke. | 🔴 | Verified (DB) |
| C7 | Position certificates are PNG/JPG only; no PDF upload. | ⚪ | By design |

---

## 5. Performance, caching, rate limiting, database

### 🟠 P1. The rate limiter doesn't work on serverless and is too strict where it does. Verified (code)
`lib/rate-limit.ts:11` is an in-memory `Map`:
- Each serverless instance has its own map, which resets on every cold start. Against a real attacker it does almost nothing.
- The key is only `ip:<ip>` or `user:<id>`, **not per route**. So certificate downloads (limit 5), hackathon live polling (20) and the teams list (20) **share one counter**. A student watching the live page can block their own certificate download.
- **Fix:** Upstash Redis (`@upstash/ratelimit`) or a Supabase table limiter (the `check_rate_limit` SQL function already exists in migration 0020). Key it by `route + user` (or `route + IP`), with higher limits for public read routes.

### 🟡 P2. Public pages fetch their data after page load. Verified (code)
These are `'use client'` pages that load data in `useEffect` via server actions:
`/events`, `/clubs`, `/clubs/[slug]`, `/leadership`, `/resources`, `/showcase`, `/community`, `/buddy-finder`, `/hackathon/*`, and the homepage.

- Visitors see a spinner first.
- Server-action calls are **POST** requests, so **no CDN cache**.
- Google indexes empty pages.

**Fix:** make them server components that fetch on the server, with `export const revalidate = 60` (or `unstable_cache` with tags), and keep only the interactive bits as client components.

### 🟡 P3. Very little caching
- Only 3 `unstable_cache` uses and 2 `revalidate` exports in the whole app.
- 123 `revalidatePath` calls invalidate pages that are rendered dynamically anyway.
- Leaderboard: the `xp_awards` query has no limit (`lib/actions/leaderboard.ts:104`), so it hits the 1000 cap once XP awards grow.

### 🟡 P4. Images
- 34 plain `<img>` tags vs 3 `next/image`.
- Uploaded banners and gallery photos are served at their original size (often 3-5 MB from phones).
- **Fix:** resize/convert to WebP on upload (`sharp`), and use `next/image` with the Supabase domain in `next.config.mjs` `images.remotePatterns`.

### 🟡 P5. Database indexes. Verified (DB)
- **Missing `registrations(event_id)`.** The only composite index is `(user_id, event_id)`, which can't serve "all registrations for an event". Every admin event page, capacity check and certificate list scans the whole table (1,002 rows now, growing).
  `CREATE INDEX idx_registrations_event ON public.registrations(event_id);`
- **Duplicate indexes** (wasted writes): `daily_checkins (user_id, event_id, checkin_date)` ×2, `feedback_responses (form_id, user_id)` ×2, `xp_awards (user_id, event_id)` ×2.
- `xp_awards(awarded_at)` would help time-filtered leaderboards.

### 🟡 P6. Full-table fetches into JavaScript
These also break at the 1000-row cap:
- `referrals.ts:96` (users)
- `profile.ts:129` (profiles)
- `force-cache-refresh.ts:27` (users)
- `fix-referrals.ts:67` (users)
- `hackathon.ts:2827`, `:2864`, `:2920` (gate logs)
- `leaderboard.ts:104` (xp_awards)

### ⚪ P7. Long jobs inside requests
Email blasts, reminders, certificate sends and the ZIP export all run inside one request, with no `maxDuration` and no queue. Use a job table plus a cron worker for anything over ~50 items.

### ⚪ P8. `select('*')` everywhere
It over-fetches columns and leaks fields (see S6). Select only the columns each page uses.

---

## 6. UI bugs

### 🟠 U1. Light-mode components inside the dark site
The root is `<html className="dark">`, so text defaults to white. Components hard-coded with `bg-white`/`text-gray-900` either show **white-on-white text** wherever an element doesn't set its own color (what happened on the admin event page, fixed today), or look out of place.

| File | Light classes | Notes |
|---|---|---|
| `app/(admin)/admin/registrations/registrations-table.tsx` | 9 | Admin is dark, so likely the same invisible-text bug as the event page |
| `components/events/poc-card.tsx` | 9 | White card on the dark event page |
| `components/events/EventFeedbackSection.tsx` | 5 | |
| `components/events/registration-card.tsx` | 3 | |
| `app/events/[id]/page.tsx` | 3 | White cards on a dark site; also sits outside the `(public)` layout group |
| `app/(hackathon-portal)/**` (manage: 186, scan: 40, volunteer-scan: 32, attendance-scan: 30, evaluate: 24) | | A deliberately light "island" (`layout.tsx` sets `bg-gray-50 text-gray-900`). Consistent inside itself, but it's a different design language from the rest of the site |

Fixed today: admin event page, Feedback manager, Feedback builder and preview, and the certificates page.

### 🟡 U2. Browser `alert()`/`confirm()` popups: 37 calls
They're blocking and unstyled, and some flows don't refresh afterwards. The cancel-registration button never refreshed the list; fixed on the event page today.

### 🟡 U4. The admin dashboard's system status is fake. Verified (code)
`app/(admin)/admin/dashboard/page.tsx:191` and `:214` always show "All Systems Operational" and "99.9% uptime this season". These are hard-coded strings, so the panel stays green while reminders have never been sent (D3) and the force-refresh button crashes (D4). Replace them with real checks (FEATURES.md → System health) or remove them.

### ⚪ U3. Loading states
Most public pages show a blank area or spinner first (see P2). Add skeletons, or move the fetching to the server.

---

## 7. Code health

| # | Issue | Where |
|---|---|---|
| H1 | `typescript.ignoreBuildErrors: true` hides **15 type errors**. Some are real, e.g. D4's missing `getServerSession` would have been caught. Others: `revalidateTag` without its second argument (deprecated in Next 16) in `lib/xp/award.ts:134,135,376,377` and `lib/actions/bug-reports.ts:118`; layout session prop types; `components/public/dynamic-form.tsx:422` animation variants. | `next.config.mjs` |
| H2 | `package.json` has `react ^18` with `next ^16`. Next 16 expects React 19 (App Router bundles its own, which hides the mismatch). | `package.json` |
| H3 | 55 `console.log` calls in server code, including referral and registration debug logs with user IDs. | `lib/actions/referrals.ts`, `registrations.ts` |
| H4 | 45 `@ts-ignore` / `as any` | across app |
| H5 | One-off scripts committed to the repo root, including a destructive `delete-user.mjs` and `test-*.js`. They read secrets from env (no hard-coded keys found). Move them to `scripts/` or delete them. | repo root |
| H6 | Every action file defines its own `getSupabase()` service-role client. Centralise it in `lib/supabase/server.ts`, with a `server-only` import so it can never reach the browser. | `lib/actions/*` |
| H7 | No tests, no error monitoring (Sentry etc.), no uptime alerts. Failures like D1, D3 and D4 went unnoticed. | — |

---

## 8. Missing features (things that should obviously exist)

| # | Feature | Why |
|---|---|---|
| F1 | **Admin and role management UI** (table-based, instant revoke) | Replaces hard-coded `ADMIN_EMAILS` (S4) |
| F2 | **Bulk attendance**: tick students, or import a CSV / Meet attendance list, for online events | Start2Code had 0/171 marked attended (D8) |
| F3 | **Registration controls**: deadline, "close registrations" toggle, **waitlist** when full | Avoids R1/R2; common ask |
| F4 | **Working reminders**: cron (D3) plus a "Send reminder now" button | Reminders have never gone out |
| F5 | **Audit log** of admin actions (who cancelled, revoked, sent, deleted) | Accountability; needed once more people have admin |
| F6 | **Email delivery tracking and retry**: list of failed emails, "retry failed" button | Bulk sends will partially fail (C2) |
| F7 | **Image processing on upload** (resize, WebP) | P4 |
| F8 | **Certificates**: "send a test to myself" before bulk sending, and a real PDF preview in the editor | Would have caught today's broken Top 1 before students saw it |
| F9 | **Error monitoring** (Sentry) with alerts on cron/email failures | H7 |
| F10 | **Paid-event flow done properly** (R3): ticket after payment, retry payment, expire pending | Needed before the first paid event |

---

## 9. Suggested order

**Today (about an hour, no UI changes):**
1. Run the S1 SQL (drop the open policies) and rotate the evaluator tokens.
2. Add auth checks to the S2/S3 actions; un-export `processReferral` and `processMissedReferrals`.
3. Deploy, so email certificate links work (C1).

**This week:**
4. Fix referrals (D1) and Buddy Finder (D2): query in SQL, not "fetch everything".
5. Add `vercel.json` cron (D3); fix the force-refresh import (D4).
6. Replace the rate limiter (P1/C3); batch certificate emails (C2).
7. Add the `registrations(event_id)` index (P5); fix IST dates (D5).

**Next:**
8. Make public pages server-rendered with caching (P2/P3) and process images on upload (P4).
9. Do atomic XP updates (D6), capacity in SQL (R1), and the registration-open checks (R2).
10. Remove `ignoreBuildErrors` after fixing the 15 type errors (H1); add Sentry (H7).
11. Build features F1, F2 and F3.
