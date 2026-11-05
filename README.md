# Feedback Collector

A full-stack feedback collection application for the Penthara Technologies
selection assignment. The project is being built in approved phases. The
current implementation includes a React/Vite client, an Express health
endpoint, local MySQL integration, the public feedback form and submission
API, admin authentication, feedback management, dashboard data APIs, and
filtered CSV export. Integration and quality checks are the current focus.

## Stack

- React, Vite, and Tailwind CSS
- Node.js and Express
- MySQL Community Server with `mysql2/promise`
- Cloudflare Turnstile for the public form (server-side verification)

## Prerequisites

- Node.js 22.12 or newer and npm
- MySQL Community Server 8.0 or newer
- Optional: MySQL Workbench for a graphical SQL editor

On Windows, install MySQL Community Server from the [official MySQL downloads
page](https://dev.mysql.com/downloads/). MySQL Workbench is optional.

## Local MySQL setup (Windows)

1. Install and configure MySQL Community Server. Choose a strong local
   administrator password during setup.
2. Start its Windows service. Find the installed service name with:

   ```powershell
   Get-Service *MySQL*
   ```

   If it is stopped, start it from Windows Services, or run PowerShell as
   Administrator and use `Start-Service <service-name>` with the name shown
   above. MySQL's Windows service behavior is described in the [official
   manual](https://dev.mysql.com/doc/refman/8.4/en/windows-start-service.html).
3. Create the database and tables by opening `server/sql/schema.sql` in
   MySQL Workbench and executing it, or by piping it into the MySQL CLI from
   the repository root:

   ```powershell
   Get-Content -Raw server/sql/schema.sql | mysql -u root -p
   ```

   The schema creates `feedback_collector` with `utf8mb4` character encoding,
   then creates the `feedback` and `admins` tables.
4. Create a restricted local application account in Workbench or the MySQL
   CLI. Replace the password placeholder with a password you choose locally;
   do not put a real password in this README or in SQL committed to Git:

   ```sql
   CREATE USER 'feedback_app'@'localhost' IDENTIFIED BY 'choose_a_local_password';
   GRANT SELECT, INSERT, UPDATE, DELETE ON feedback_collector.* TO 'feedback_app'@'localhost';
   ```

## Configure environment

Copy the example and edit `server/.env` with your local MySQL application
account values:

```powershell
Copy-Item server/.env.example server/.env
```

Set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`. The example
uses `localhost:3306` and `feedback_collector`. Generate a local JWT secret
with Node and paste the result into `JWT_SECRET`:

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
password of at least 12 characters. Then run this once from the repository
root:

```powershell
npm run admin:init --workspace server
```

The command inserts a bcrypt password hash and refuses to overwrite an
existing account. Passwords must be at least 12 characters and no more than
72 UTF-8 bytes (bcrypt's input limit).

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
fields before sending, uses an editable prompt suggestion, and requires a
Turnstile token. Its client validation checks can be run with
`npm run test:form --workspace client`.

The Vite client runs at `http://localhost:5173` and proxies `/api` to the
Express server at `http://localhost:3000`. The backend checks database
configuration and connectivity on startup. Confirm the local MySQL service
is running and `server/.env` is correct if it exits with a database error.

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

Run admin authentication integration checks against local MySQL:

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
checks against local MySQL:

```powershell
npm run api:admin-feedback-test --workspace server
```

This check creates unique temporary fixture rows and an admin account, tests
combined filters and boundary cases through the API, then removes its rows.

Run protected dashboard statistics and chart integration checks against
known temporary MySQL records:

```powershell
npm run api:dashboard-test --workspace server
```

The dashboard API reports total, UTC-today, and Monday-to-current-day UTC
week counts. Chart data covers the most recent 30 UTC dates and includes
bounded rating and feedback-type distributions. The protected React admin
dashboard is available at `http://localhost:5173/admin` after initializing an
admin account.

Download all filtered feedback as a CSV from the admin dashboard. The
protected export ignores list pagination, returns at most 10,000 rows, includes
numeric ratings and labels, writes UTC timestamps, and neutralizes spreadsheet
formula cells. Verify the export
route and tricky CSV values against local MySQL with:

```powershell
npm run api:csv-test --workspace server
```

Run the end-to-end public submission → local MySQL → authenticated admin
list/export/delete flow against local MySQL (Turnstile Siteverify is stubbed
for this deterministic integration check):

```powershell
npm run api:e2e-test --workspace server
```

## Local demo checklist

1. Start the local MySQL Windows service and confirm the `feedback_collector`
   schema exists. On a first setup, import `server/sql/schema.sql` as described
   above.
2. Confirm `server/.env` and `client/.env.local` exist locally and are ignored
   by Git. The server file must contain a local MySQL account and a long,
   random `JWT_SECRET`.
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
- The project is intended to be demonstrated locally. Cloud hosting and
  hosted databases are deferred unless explicitly requested.
- The initial admin must be initialized manually; there is no public
  registration or password reset flow.
- The deterministic API checks stub Turnstile Siteverify; test keys used in
  the browser still need a working internet connection to reach Cloudflare.
- The source snapshot must be committed before a clean GitHub checkout can be
  independently reproduced. Do not commit `.env` files, database dumps, or
  real feedback records.
