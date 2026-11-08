# PROJECT_SPEC_LOCAL_DB_UPDATE.md
## Addendum and superseding instructions for Codex CLI

> Historical database/deployment decision: this local-MySQL addendum was
> superseded by the developer's later approved Neon PostgreSQL migration and
> public-deployment decision. Its product, feature, security, and phase-by-phase
> workflow requirements remain applicable where they do not conflict with that
> later decision.

**Project:** Feedback Collector — Penthara Technologies selection assignment  
**Purpose:** This file updates the previously supplied `PROJECT_SPEC.md`. It changes the database and deployment assumptions from cloud-first to local-first. It also clarifies the implementation workflow so work already performed by Codex is preserved.

---

## 1. Instruction priority — read this first

The developer has already provided Codex with an earlier file named `PROJECT_SPEC.md`.

**Read both files before making further changes:**
1. `PROJECT_SPEC.md` — the original full project specification.
2. `PROJECT_SPEC_LOCAL_DB_UPDATE.md` — this update.

This update supersedes the original specification **only where database hosting, environment configuration, deployment, and related workflow instructions conflict**. All other product requirements, features, security requirements, code-quality expectations, architecture principles, documentation requirements, and phase-by-phase approval rules in the original specification remain in force.

Do not restart the project, discard completed work, or blindly regenerate files. First inspect the current repository and identify:
- which phase Codex has reached;
- which files and features have already been implemented;
- whether any cloud-database-specific code or configuration has been added;
- what needs to change to comply with this update.

Preserve correct work. Propose a concise reconciliation plan before editing. If the current work is already compatible, leave it alone.

**Do not begin the next implementation phase until the developer approves the reconciliation plan.** After approval, continue from the actual current state, not from Phase 0 unless the repository is genuinely still at Phase 0.

---

## 2. Confirmed revised database decision

### Use local MySQL Community Server for development and assignment demonstration.

Do **not** use TiDB Cloud, PlanetScale, Aiven, Railway, Render Postgres, or any other hosted database for this assignment's default setup.

The local development stack is:

- React + Vite + Tailwind CSS
- Node.js + Express.js
- `mysql2` promise API and connection pool
- MySQL Community Server installed on the developer's computer
- MySQL Workbench is optional and may be used as a GUI to inspect the local database

The application must connect to MySQL through the Express backend. The React frontend must never connect directly to MySQL or contain database credentials.

### Why this decision was made

This is a one-week assignment whose submission requirement is a GitHub repository link. A cloud database adds account setup, provider configuration, network dependencies, free-tier restrictions, and deployment work that are not necessary to demonstrate the required full-stack skills.

Prioritize a complete, tested, understandable application and a reproducible local setup over public hosting infrastructure.

---

## 3. Local database setup requirements

Create and maintain a SQL schema file at:

`server/sql/schema.sql`

It must:
- create the project database if appropriate, or clearly document the database name to create;
- create the `feedback` table and `admins` table from the original specification;
- define appropriate primary keys, unique constraints, nullability, data types, and indexes;
- use a consistent character set and collation that support Unicode, such as `utf8mb4`;
- use a documented, consistent timestamp convention (prefer UTC storage);
- be safe to run on a fresh local MySQL installation;
- avoid provider-specific SQL features.

Document the exact setup steps in `README.md`, including:
1. Install MySQL Community Server (and optionally MySQL Workbench).
2. Start the local MySQL service.
3. Create the project database, if the schema does not create it.
4. Run `server/sql/schema.sql`.
5. Create/configure the local environment file.
6. Install dependencies and start the backend and frontend.
7. Create the initial admin account through the safe setup procedure described in the original specification.

Do not put a real database password in source code, SQL files, README examples, screenshots, or Git history. Use placeholders in documentation.

---

## 4. Environment configuration

Keep all database connection values configurable through environment variables.

The server `.env.example` should document the required local variables, for example:

```env
NODE_ENV=development
PORT=5000

DB_HOST=localhost
DB_PORT=3306
DB_USER=your_local_mysql_username
DB_PASSWORD=your_local_mysql_password
DB_NAME=feedback_collector

JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=1d

TURNSTILE_SECRET_KEY=your_cloudflare_turnstile_secret_key
CLIENT_ORIGIN=http://localhost:5173
```

The actual `.env` file must be ignored by Git. Keep `.env.example` committed with placeholders only.

Use `mysql2` connection pooling and validate required environment variables at server startup. Fail with a clear, safe configuration error if required values are missing. Never print passwords, JWT secrets, CAPTCHA secrets, or full connection strings in logs.

Do not hardcode `localhost`, database credentials, or the database name throughout application code. Read configuration centrally and use environment variables.

If the existing code uses different environment variable names, Codex may retain them if they are consistent and documented. Avoid unnecessary renaming solely to match this example.

---

## 5. CAPTCHA remains in scope

Cloudflare Turnstile remains part of the public feedback form.

For local development:
- Use Cloudflare's documented Turnstile test site key and test secret key where appropriate.
- Keep the secret key exclusively on the server.
- Verify the token server-side using Cloudflare Siteverify.
- Make the keys configurable through environment variables.
- Do not disable CAPTCHA verification silently or accept arbitrary tokens as a workaround.
- Clearly distinguish test keys from production keys in `.env.example` and README.

The local MySQL choice does not remove the need for internet access when testing the real Turnstile verification endpoint. If the network or Cloudflare verification service is unavailable, show a safe, understandable error and do not save the submission as if CAPTCHA verification succeeded.

---

## 6. Authentication and security remain unchanged

Retain the original decisions:
- JWT-based admin authentication in an HTTP-only cookie.
- Password hashing with bcrypt/bcryptjs.
- No public admin registration.
- Safe initial admin creation.
- Backend authorization middleware on every admin endpoint.
- SQL parameterization through `mysql2`.
- Server-side validation.
- Rate limiting.
- Safe error responses.
- Context-appropriate output handling; render feedback as text, never raw HTML.
- Turnstile server-side verification.
- Secure cookie settings appropriate to the environment.

For local HTTP development, configure cookie options so authentication works on `localhost`. In production HTTPS, set `Secure` appropriately. Keep `HttpOnly` and an appropriate `SameSite` policy. Do not weaken authorization or security controls just to make local testing convenient.

The application must continue to keep all database access on the backend.

---

## 7. Revised deployment and submission plan

### Default submission: GitHub repository with reproducible local setup

The default deliverable is:
- a complete GitHub repository;
- working local React + Express + MySQL application;
- `server/sql/schema.sql`;
- `.env.example` with placeholders;
- clear README setup instructions;
- documented API and architecture;
- tests or documented manual verification steps;
- no secrets, local database dumps, or real user feedback committed.

Do not spend assignment time configuring Render, TiDB Cloud, or another cloud database unless the employer explicitly asks for a live hosted demo.

### If a live deployment is later explicitly required

Treat deployment as a separate, optional task. Stop and ask the developer before choosing or configuring any hosted database or hosting provider.

A hosted database migration must:
- preserve the local development workflow;
- use environment variables so the same code can point to local or hosted MySQL-compatible databases;
- be tested against the selected provider;
- not introduce a paid service, payment method, consumption billing, paid fallback, or automatic upgrade;
- remain subject to the developer's explicit approval.

Do not claim the application is deployed or publicly accessible unless it has actually been deployed and verified.

---

## 8. Changes to the original phase plan

Keep the original phase-by-phase workflow and approval gates, but apply these updates:

### Phase 0 — Inspect and reconcile
- Read both specification files.
- Inspect the current repository and Codex progress.
- Identify cloud database assumptions or deployment work already performed.
- Present a reconciliation plan.
- Do not modify code before approval.

### Phase 1 — Project scaffolding
- Scaffold React/Vite, Tailwind, Express, scripts, environment handling, and health endpoint.
- No cloud database provisioning.

### Phase 2 — Local MySQL schema and connection
- Provide `server/sql/schema.sql`.
- Configure `mysql2` pool from environment variables.
- Verify connection to local MySQL.
- Test schema creation on a fresh local database.
- Explain the tables, keys, indexes, and connection pool.

### Remaining phases
Continue with the original phases for public feedback APIs, CAPTCHA verification, admin authentication, feedback management, dashboard statistics/charts, React UI, CSV export, integration testing, and documentation.

### Final phase — local handoff and reproducibility
Replace the original cloud deployment emphasis with:
- clean-checkout setup verification;
- local MySQL installation and schema instructions;
- `.env.example` verification;
- frontend/backend startup instructions;
- production build check;
- GitHub repository hygiene;
- README review;
- end-to-end demo checklist.

Do not spend time on cloud deployment unless explicitly requested later.

---

## 9. Documentation changes required

Update these files to reflect local MySQL:

### `README.md`
Include:
- project overview and features;
- prerequisites (supported Node.js version and MySQL Community Server);
- local database creation and schema import;
- environment variable setup;
- install and run commands;
- initial admin setup;
- Turnstile test-key instructions;
- API overview;
- testing instructions;
- security notes;
- known local-development limitations.

Remove outdated instructions that tell the developer to create a TiDB Cloud account, configure a cloud database, or provision Render/TiDB services as a required setup step.

### `docs/ARCHITECTURE.md`
Show the local data flow:

`React browser → Express REST API → mysql2 connection pool → local MySQL`

Explain that the frontend never connects directly to MySQL.

### `docs/DECISIONS.md`
Record:
- local MySQL Community Server selected for the one-week assignment;
- cloud database intentionally deferred because the expected submission is a GitHub repository;
- database configuration remains environment-based to keep future migration possible;
- any later hosting decision requires explicit approval.

### `docs/API.md`
Keep the original API contract. No API changes are required solely because the database is local.

---

## 10. Preserve the original project requirements

This update does **not** remove or weaken any of the following requirements from `PROJECT_SPEC.md`:

- Public feedback form with name, email, and message.
- Feedback type and five-level illustrated rating.
- Optional, editable prewritten feedback statements selected by type/rating and filtered as the visitor types; no generated questions or AI service.
- Cloudflare Turnstile CAPTCHA with server-side verification.
- Protected admin login.
- Feedback list, keyword/date/type/rating filters, sorting and server-side pagination.
- Delete with confirmation.
- Dashboard statistics and meaningful charts based on real database data.
- CSV export of all matching records, with formula-injection protection.
- Responsive, accessible UI.
- Parameterized SQL, validation, rate limiting, safe errors, secure authentication, and no committed secrets.
- Clear project structure, naming, useful comments, and maintainable code.
- `README.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, and `docs/DECISIONS.md`.
- Phase-by-phase implementation, explanation, testing, acceptance checklist, and explicit developer approval before moving to the next phase.

The original specification remains authoritative for all details not changed here.

---

## 11. Mandatory first response from Codex after reading this update

Before editing anything, respond with:

1. Current project phase and what has already been completed.
2. Any existing cloud database or deployment assumptions found.
3. Files that need changes, if any.
4. A concise plan to reconcile the current project with local MySQL.
5. Confirmation that all other original requirements remain intact.
6. Any blockers or questions.

**Then stop and wait for approval. Do not implement the reconciliation until approval is given.**

After approval, make only the necessary changes and continue the project from its actual current state. At the end of each subsequent phase, explain what changed, how it works, what was tested, what remains, and wait for approval before continuing.
