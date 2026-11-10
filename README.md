# Feedback Collector

Feedback Collector is a full-stack feedback app built for the Penthara Technologies selection assignment.

Visitors can submit structured feedback. An administrator can sign in, review submissions, filter them, view dashboard data, delete records, and export the results.

## Features

- **Feedback form** — Collects a name, email address, feedback type, rating, and message.
- **Feedback types and ratings** — Uses six feedback types and a five-level illustrated rating.
- **Content suggestions** — Shows predefined editable suggestions based on the selected type and rating.
- **Turnstile protection** — Uses Cloudflare Turnstile to help reduce automated bot submissions.
- **Admin dashboard** — Provides a protected workspace for reviewing feedback.
- **Search and filters** — Filter by keyword, date range, feedback type, and rating.
- **Sorting and pagination** — Sort by newest or oldest and load records page by page from the server.
- **Delete confirmation** — Requires confirmation before permanently deleting a feedback record.
- **Statistics and charts** — Shows totals, UTC day/week counts, activity, ratings, and feedback types.
- **CSV export** — Downloads all records matching the current filters and sorting.
- **Excel export** — Downloads a formatted `.xlsx` workbook with styled headers, column widths, UTC dates, and a frozen header row.
- **Responsive interface** — Supports desktop, tablet, and mobile layouts with keyboard-friendly controls.

## Security

The application uses several separate protections:

- Submitted data is validated and normalized on the server.
- Database values are passed through parameterized PostgreSQL queries.
- Feedback is rendered as text rather than inserted as HTML.
- Turnstile tokens are verified through Cloudflare on the server.
- Public submissions and admin login attempts are rate-limited.
- Admin passwords are stored as bcrypt hashes.
- Admin sessions use signed JWTs in HTTP-only cookies.
- Same-origin checks protect state-changing authentication and delete requests.
- Security headers and a Content Security Policy are applied by Express.
- CSV values are protected against spreadsheet formula injection.
- Secrets, database URLs, and credentials are loaded from ignored environment files.

These controls reduce common risks, but they are not a substitute for normal operational security and monitoring.

## Design

The interface uses a Penthara Technologies-inspired visual direction with purple and magenta accents. It is an assignment project and is not an official Penthara Technologies product or company design.

## Tech stack

- **React** — Builds the public form and admin dashboard.
- **Vite** — Provides the frontend development server and production build.
- **Node.js and Express** — Serve the REST API and production frontend.
- **Neon PostgreSQL** — Stores feedback and administrator records.
- **`pg`** — Provides the PostgreSQL connection pool.
- **ExcelJS** — Generates formatted Excel workbooks.
- **bcryptjs and JSON Web Token** — Handle password hashing and admin sessions.
- **Cloudflare Turnstile** — Helps protect the public form from automated submissions.

## Architecture

The browser talks to the Express REST API. Express validates requests, checks authentication, and communicates with PostgreSQL through the `pg` connection pool.

```text
React browser → Express REST API → pg connection pool → Neon PostgreSQL
```

The browser never connects directly to PostgreSQL and never receives database credentials. During development, Vite proxies `/api` requests to Express. In a production setup, Express can serve the built React app and API from the same origin.

## Local setup

### Prerequisites

- Node.js 22.12 or newer
- npm
- Access to the configured Neon project
- Internet access when testing real Cloudflare Turnstile verification

### Install dependencies

From the repository root:

```powershell
npm install
```

### Configure Neon

The project uses Neon PostgreSQL for the application runtime. If the Neon CLI is configured for the project, refresh the local database variables with:

```powershell
neon deploy
```

This writes `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and `NEON_BRANCH` to the ignored root `.env.local` file.

### Configure application environment files

Create the server environment file:

```powershell
Copy-Item server/.env.example server/.env
```

Create the client environment file:

```powershell
Copy-Item client/.env.example client/.env.local
```

Set the application values in `server/.env`, especially:

- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `TURNSTILE_SECRET_KEY`
- `CLIENT_ORIGIN`
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` for first-time admin setup

The client uses `VITE_TURNSTILE_SITE_KEY`. The example files contain Cloudflare's documented local test keys. Use live keys only outside local testing.

### Initialize the database and admin

Initialize the PostgreSQL tables:

```powershell
npm run db:init --workspace server
```

Create the first administrator:

```powershell
npm run admin:init --workspace server
```

The admin command creates a bcrypt hash and does not overwrite an existing account. There is no public admin registration route.

### Start the application

Run the backend and frontend in separate terminals:

```powershell
npm run dev:server
```

```powershell
npm run dev:client
```

Open:

- Public form: `http://localhost:5173`
- Admin dashboard: `http://localhost:5173/admin`
- API health check: `http://localhost:3000/api/health`

## Useful checks

```powershell
npm run test:form --workspace client
npm run test:ui --workspace client
npm run db:config-test --workspace server
npm run db:smoke --workspace server
npm run api:public-test --workspace server
npm run api:auth-test --workspace server
npm run api:admin-feedback-test --workspace server
npm run api:dashboard-test --workspace server
npm run api:csv-test --workspace server
npm run api:e2e-test --workspace server
npm run build
```

The API integration checks use temporary records and clean them up. Some checks use a deterministic Turnstile stub instead of making a live Cloudflare request.

## Existing MySQL migration

The running application uses Neon PostgreSQL. The repository retains the local MySQL schema and migration script for the approved one-time migration and fallback workflow.

The migration defaults to a dry run:

```powershell
npm run db:migrate:mysql --workspace server
```

Apply only after reviewing the dry-run result:

```powershell
npm run db:migrate:mysql --workspace server -- --apply
```

## Deployment

The application is deployed on Render as a single Web Service that serves both the compiled React frontend and the Express API.

- **Live app:** `https://feedback-collector-2nfo.onrender.com`
- **Admin dashboard:** `https://feedback-collector-2nfo.onrender.com/admin`
- **API health check:** `https://feedback-collector-2nfo.onrender.com/api/health`

PostgreSQL is hosted on Neon. Express serves the Vite production build from `client/dist` and the API from the same origin, so no separate static frontend service is required.

### Render service settings

| Setting | Value |
|---|---|
| Root directory | `.` |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| Runtime | Node.js 22.12 or newer |

### Production environment variables

Configure these in the Render service before deploying:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `TURNSTILE_SECRET_KEY`
- `VITE_TURNSTILE_SITE_KEY`
- `CLIENT_ORIGIN` — must exactly match `https://feedback-collector-2nfo.onrender.com`
- `TRUST_PROXY_HOPS=1`
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` only when initializing the first administrator

Do not set `NODE_ENV` manually. `VITE_TURNSTILE_SITE_KEY` is embedded during the frontend build, so changing it requires a rebuild and redeploy. The site key and secret must belong to the same Cloudflare Turnstile widget, and the deployed Render hostname must be authorized in that widget.

### Why the first page load can take some time

The live site can be slow on the first visit because Render may spin down an idle web service, especially on the free instance type. The next request starts the service again through a cold start, which commonly takes around 30–60 seconds and can occasionally take longer. After the service is awake, subsequent page loads are fast. A service that was just deployed or rebuilt may also take a few minutes to finish its initial build and release. This is expected Render behavior rather than an application error.

### Post-deployment checks

1. Open `/api/health` and confirm it returns a successful response.
2. Open the public form and submit a test feedback entry with the live Turnstile widget.
3. Open `/admin` and confirm the administrator can sign in.
4. If admin login returns `403 Request origin is not allowed`, verify that `CLIENT_ORIGIN` matches the deployed origin exactly and redeploy.

## Demo access

Dedicated evaluation credentials will be provided separately to the evaluator. No real passwords, JWT secrets, database credentials, or private environment values are included in this repository.

## Project documentation

The repository also contains the project specification, API contract, architecture notes, decisions, and demo walkthrough. These files are kept as project records and are not required for the basic local setup above.
