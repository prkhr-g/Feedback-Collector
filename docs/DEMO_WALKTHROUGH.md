# Feedback Collector: CEO Walkthrough

**Target time:** 4–5 minutes  
**Demo mode:** local React and Express connected to Neon PostgreSQL. Neon is
the database only; the application retains its own admin authentication.

## Before the demo

- Confirm the root `.env.local` has Neon runtime values and initialize the
  schema with `npm run db:init --workspace server`.
- Confirm `server/.env` and `client/.env.local` are configured and remain untracked.
- Start the API and client in separate terminals with `npm run dev:server` and `npm run dev:client`.
- Open `http://localhost:5173` and `http://localhost:5173/admin`. Use the existing initialized admin account.
- Browser CAPTCHA uses Cloudflare's documented test keys and needs internet access. API integration checks stub Siteverify; they do not demonstrate live Cloudflare connectivity.

## Talk track and demo

### 1. Problem and objective — 20 seconds

“Feedback Collector gives visitors a simple way to submit structured feedback and gives an administrator a protected workspace to understand and manage it. It is a full-stack assignment project designed to run reproducibly on a local machine.”

### 2. Public submission — 45 seconds

On the public page, show the name, email, feedback type, five-level accessible rating, optional prewritten feedback statements matched to type/rating, editable message, and Turnstile widget. Type to filter suggestions, select and edit one, then enter a disposable demo record and submit it. Point out the confirmation and form reset after success.

“The browser validates for usability. The API validates again, normalizes name/email/message values, checks the allowed type and rating, applies rate limiting, verifies the CAPTCHA token server-side, and only then inserts the record.”

### 3. Data flow — 30 seconds

```text
React browser → Vite /api proxy → Express REST API → pg pool → Neon PostgreSQL
```

“The browser never connects to PostgreSQL and never receives database credentials. The API uses a bounded pool, stores timestamps as instants, and applies UTC date boundaries explicitly.”

### 4. Admin dashboard and feedback management — 60 seconds

Sign in at `/admin`. Show the total, today, and current-week statistics, then the bounded volume, rating, and feedback-type charts. Scroll to the feedback list and demonstrate a keyword search plus one or two filters, sorting, and pagination.

“All admin endpoints enforce authorization on the server. The UI uses an HttpOnly session cookie; it does not store the JWT in browser storage. Filters and pagination run in PostgreSQL rather than downloading the full dataset to the browser.”

### 5. Export and deletion — 40 seconds

Export the filtered list. Open the downloaded CSV and point out the numeric rating, rating label, and UTC timestamp. Then select the disposable demo record, show that the confirmation names the record, and confirm deletion.

“CSV export includes every record matching the filters, regardless of the visible page. It is capped at 10,000 rows, quotes commas/quotes/newlines, and neutralizes spreadsheet formulas. Delete uses a parameterized query and requires same-origin protection.”

### 6. Code organization and safeguards — 45 seconds

- `client/src/components/` — public form, Turnstile widget, and admin UI.
- `client/src/services/` and `client/src/utils/` — API calls and client validation.
- `server/src/routes/` and `server/src/controllers/` — HTTP routes and request handling.
- `server/src/services/` — authentication, feedback, dashboard, and CAPTCHA operations.
- `server/src/config/` — database pool and authentication configuration.
- `server/sql/postgres-schema.sql` — Neon PostgreSQL schema.
- `server/scripts/` and `client/scripts/` — database/API integration and client checks.

“SQL values are parameterized, feedback renders as text rather than HTML, passwords use bcrypt, sessions use an HttpOnly cookie, responses set security headers, and validation/CAPTCHA/rate limits are enforced on the server.”

## Trade-offs and limitations

- The local MySQL database remains intact as a fallback; the approved one-time migration to Neon was verified and did not modify the source.
- Real browser Siteverify requires internet access. Automated public API tests use a deterministic Siteverify stub.
- The rate limiter is in-memory, so it resets when the server restarts and is intended for one application instance.
- CSV export is limited to 10,000 matching records. Admin password reset and public admin registration are not implemented.
- A future hosted demo, persistent rate limiting, or account recovery flow would need separate scope and approval.

## Verified checks to cite

The user-provided run confirmed Neon schema initialization, PostgreSQL smoke/UTC checks, public feedback, authentication, feedback management, CSV, client tests, and the production build. The dashboard chart and end-to-end checks passed after the UTC date parsing correction. The MySQL-to-Neon migration dry run and apply both completed with matching source/target counts and no conflicts.

## Closing

“The project demonstrates the full feedback lifecycle with a real local relational database, protected administration, and reproducible tests. The repository documents setup and limitations; deployment remains intentionally out of scope for this local-first assignment.”
