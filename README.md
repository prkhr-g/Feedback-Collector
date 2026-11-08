# Feedback Collector

A full-stack feedback collection application for the Penthara Technologies
selection assignment. The project is being built in approved phases. The
current implementation includes a React/Vite client, an Express API, Neon
PostgreSQL integration, the public feedback form and submission API, existing
application-level admin authentication, feedback management, dashboard data
APIs, and filtered CSV export. The approved one-time migration of local
MySQL data to Neon has been completed and verified. Public deployment remains
a separate phase.

## Stack

- React, Vite, and Tailwind CSS
- Node.js and Express
- Neon PostgreSQL with the `pg` connection pool
- Cloudflare Turnstile for the public form (server-side verification)

## Prerequisites

- Node.js 22.12 or newer and npm
- Neon project access for the configured project

Neon is used only as PostgreSQL hosting. The application keeps its existing
admin login; Neon Auth is disabled. Runtime uses Neon's pooled `DATABASE_URL`;
schema initialization uses `DATABASE_URL_UNPOOLED`.

## Neon environment setup

The project has already been initialized with the Neon CLI. To refresh local
environment values from the project root, run:

```powershell
neon deploy
```

The CLI writes `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and `NEON_BRANCH` to
the ignored root `.env.local`. Never commit or print that file. Copy
`server/.env.example` to `server/.env` for application secrets and local
settings such as JWT, Turnstile, admin initialization, and client origin.

## Configure environment

Copy the example and edit `server/.env` with application secrets and runtime
settings:

```powershell
Copy-Item server/.env.example server/.env
```

Set `JWT_SECRET`, `TURNSTILE_SECRET_KEY`, `CLIENT_ORIGIN`, and any admin
initialization values there. PostgreSQL URLs come from the root `.env.local`.
The optional `DB_*` values are used only to read the local MySQL source during
the one-time migration; the running app does not use them.
Generate a local JWT secret with Node and paste the result into `JWT_SECRET`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

For local CAPTCHA testing, Cloudflare provides dedicated Turnstile test keys.
Use the documented always-pass site key `1x00000000000000000000AA` and secret
key `1x0000000000000000000000000000000AA` in local development only. These
keys are public test credentials; never use them for a live site. Cloudflare
documents [test keys and their behavior](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).
The secret belongs only in `server/.env`; the site key is safe for the client.
Configure the client site key by copying the example to its ignored local
environment file:

```powershell
Copy-Item client/.env.example client/.env.local
```

The client example contains Cloudflare's public test site key, and the server
example contains its matching documented test secret. These are public test
credentials for local development only. For another widget, set its public
site key as `VITE_TURNSTILE_SITE_KEY` in `client/.env.local`; never put a
secret in a `VITE_` variable. Restart Vite after changing the client file.

There is no public admin registration route. To create the first admin, set
`ADMIN_EMAIL` and `ADMIN_PASSWORD` in the untracked `server/.env`. Use a
password of at least 12 characters. First initialize the schema as shown
below; then run this once from the repository root:

```powershell
npm run admin:init --workspace server
```

The command inserts a bcrypt password hash and refuses to overwrite an
existing account. Passwords must be at least 12 characters and no more than
72 UTF-8 bytes (bcrypt's input limit).

Initialize the PostgreSQL schema before the first server start:

```powershell
npm run db:init --workspace server
```

This uses `DATABASE_URL_UNPOOLED` and can be run repeatedly. It creates only
the application tables; it does not create or alter the Neon project/database.

## Migrate existing local MySQL data

The migration reads the local database in a consistent, read-only snapshot and
uses Neon's direct URL for target checks and inserts. It preserves record IDs,
admin password hashes, and UTC timestamps. The default command is a dry run;
it reports source/target counts, matching rows, pending inserts, and conflicts
without printing record contents or changing either database:

```powershell
npm run db:migrate:mysql --workspace server
```

Review the dry-run counts and require zero conflicts before applying. Then run:

```powershell
npm run db:migrate:mysql --workspace server -- --apply
```

The apply operation is transactional on Neon and safe to rerun: identical
target rows are skipped, conflicting IDs or admin emails stop the migration,
and the local MySQL source is never modified. Keep the local MySQL database as
the fallback; never commit exports, dumps, feedback text, or credentials. The
migration plan/date conversion checks can be run with:

```powershell
npm run db:migration-test --workspace server
```

## Install and run

From the repository root, install dependencies:

```powershell
npm install
```

Run the backend and frontend in separate terminals:

```powershell
npm run dev:server
```

```powershell
npm run dev:client
```

The public feedback form is available at `http://localhost:5173`. It validates
fields before sending, offers optional prewritten feedback statements matched
to the selected type and rating, and requires a Turnstile token. Suggestions
filter locally as the visitor types and remain editable. Its client validation checks can be run with
`npm run test:form --workspace client`.

The public page includes a live, read-only preview of the selected feedback
type, rating, and message. At desktop widths (1,201 CSS pixels and above), the
footer is hidden so the centered form layout has more room; it remains visible
on narrower screens, where the page scrolls naturally as needed.

The Vite client runs at `http://localhost:5173` and proxies `/api` to the
Express server at `http://localhost:3000`. The backend validates `DATABASE_URL`
and checks PostgreSQL connectivity on startup. If it exits with a database
error, confirm Neon connectivity and the ignored root `.env.local`.

To run the database insert/select smoke check after dependencies, schema, and
environment are ready:

```powershell
npm run db:smoke --workspace server
```

The check inserts a temporary row inside a transaction, reads it using a
parameterized query, and rolls the transaction back.

Run the database integration check for pooled-session UTC behavior, timestamp
defaults, and timestamp round-tripping:

```powershell
npm run db:integration --workspace server
```

Run the public API integration checks for validation, CAPTCHA responses,
rate limiting, security headers, and a temporary database insert:

```powershell
npm run api:public-test --workspace server
```

The check stubs Siteverify for deterministic success and failure cases and
deletes the test row. A separate manual check with Cloudflare's documented
Turnstile test keys verifies real outbound Siteverify connectivity.

Run admin authentication integration checks against Neon PostgreSQL:

```powershell
npm run api:auth-test --workspace server
```

Login returns an `HttpOnly; SameSite=Lax` cookie scoped to `/api`. The backend
validates its signed session on `/api/auth/me`; logout clears the cookie.
State-changing auth requests require an exact same-origin `Origin` match.
Sessions use HS256 and `JWT_SECRET`; passwords use bcrypt hashes with 12
rounds. Existing scrypt hashes are upgraded after a successful login.
`JWT_EXPIRES_IN` accepts a positive duration up to 30 days.

Run protected feedback list/filter/pagination/detail/delete integration
checks against Neon PostgreSQL:

```powershell
npm run api:admin-feedback-test --workspace server
```

This check creates unique temporary fixture rows and an admin account, tests
combined filters and boundary cases through the API, then removes its rows.

Run protected dashboard statistics and chart integration checks against
known temporary PostgreSQL records:

```powershell
npm run api:dashboard-test --workspace server
```

The dashboard API reports total, UTC-today, and Monday-to-current-day UTC
week counts. Chart data covers the most recent 30 UTC dates and includes
bounded rating and feedback-type distributions. The protected React admin
dashboard is available at `http://localhost:5173/admin` after initializing an
admin account.

Download all filtered feedback as CSV or XLSX from the admin dashboard. The
protected export ignores list pagination, includes numeric ratings and labels,
writes UTC timestamps, and neutralizes spreadsheet formula cells in CSV values.
The XLSX workbook uses styled headers, readable column widths, and a frozen
header row. Verify the export
route and tricky CSV values against PostgreSQL with:

```powershell
npm run api:csv-test --workspace server
```

Run the end-to-end public submission → PostgreSQL → authenticated admin
list/export/delete flow against Neon (Turnstile Siteverify is stubbed
for this deterministic integration check):

```powershell
npm run api:e2e-test --workspace server
```

## Local demo checklist

1. Confirm Neon is reachable and `server/sql/postgres-schema.sql` has been
   initialized with `npm run db:init --workspace server`.
2. Confirm root `.env.local`, `server/.env`, and `client/.env.local` exist
   locally and are ignored by Git. `server/.env` must contain a long, random
   `JWT_SECRET`.
3. Start `npm run dev:server` and `npm run dev:client` in separate terminals.
   Confirm `http://localhost:3000/api/health` returns `{"success":true,"status":"ok"}`.
4. Submit a disposable feedback entry at `http://localhost:5173` using the
   local Turnstile test key. Real Siteverify checks require internet access.
5. Sign in at `http://localhost:5173/admin` with the initialized admin. Show
   the dashboard, feedback list, combined filters, sorting, and pagination.
6. Export the filtered rows to CSV and confirm its numeric rating, label, and
   UTC timestamp. Delete only the disposable entry after confirming the
   dialog.
7. Run the database, API, end-to-end, client structure, and production build
   checks listed above before handing off the repository.

Run client form and admin UI structural checks with:

```powershell
npm run test:form --workspace client
npm run test:ui --workspace client
```

## API and project documents

- `GET /api/health` reports whether the Express process is responding.
- [API contract](docs/API.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Decision record](docs/DECISIONS.md)
- [CEO demo walkthrough](docs/DEMO_WALKTHROUGH.md)
- [Project specification](PROJECT_SPEC.md)
- [Local database update](PROJECT_SPEC_LOCAL_DB_UPDATE.md)

## Security and local limitations

- Keep `server/.env` private. It is ignored by Git; commit only
  `server/.env.example` with placeholders.
- Database access stays in Express. The browser never receives database
  credentials.
- Use local development keys only for Turnstile. The public API verifies
  tokens server-side. Replace test keys with a real Turnstile key pair for
  non-local use. Admin routes require the HttpOnly session cookie; the browser
  does not store JWTs in local or session storage.
- The React/Express application currently runs locally and uses Neon
  PostgreSQL. The approved MySQL-to-Neon copy was verified; the local MySQL
  source is retained unchanged as a fallback. Public hosting is a separate
  approved phase.
- The initial admin must be initialized manually; there is no public
  registration or password reset flow.
- The deterministic API checks stub Turnstile Siteverify; test keys used in
  the browser still need a working internet connection to reach Cloudflare.
- The source snapshot must be committed before a clean GitHub checkout can be
  independently reproduced. Do not commit `.env` files, database dumps, or
  real feedback records.

## Production readiness (before deployment)

The root `build` command creates the React production bundle, and the root
`start` command starts Express. Express serves `client/dist` and its SPA routes
alongside `/api`, so one Node web service can host the whole application.
The server checks Neon, JWT, application origin, and Turnstile configuration
before listening. In production, `CLIENT_ORIGIN` must be the public HTTPS
origin, `JWT_SECRET` must be a unique random secret, and Turnstile must use the
live secret paired with the deployed frontend's public
`VITE_TURNSTILE_SITE_KEY` build variable.

Set `TRUST_PROXY_HOPS` to the exact number of trusted reverse proxies in front
of Express (commonly `1` for a single managed host proxy). It defaults to
`0`; do not set it to `true` or a value larger than the actual proxy chain,
because client-IP rate limits rely on this trust boundary. The current
in-memory rate limiters are per process and reset on restart, so they are
suitable only for the planned single-instance evaluation deployment.
`GET /api/health` is a process health check; startup separately confirms the
database is reachable.
