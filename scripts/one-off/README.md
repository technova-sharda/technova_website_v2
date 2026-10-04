# One-off scripts (not part of the app)

Old maintenance and debugging scripts, moved out of the repo root on 4 Oct 2026.
Nothing in the app imports them.

**Several of these change or delete production data**, for example
`delete-user.mjs`, `clear-students.js`, `reset-db.js` and `make-all-live.js`.
They run with the service-role key from `.env`, which means the real database.
Don't run anything here unless you know exactly what it does, and take a backup first.
