# Feedback Collector --- Master Project Specification

## Purpose and operating rule

Build a practical, secure, maintainable full-stack Feedback Collector
for the Penthara Technologies selection assignment. This file is the
source of truth for Codex CLI. Read it before changing files.

**Work phase by phase. Do not build the entire project in one pass.** At
the end of each phase, explain the changes, show tests and acceptance
results, explain the important code, then wait for the developer's
approval.

**Budget is a hard constraint: ₹0 / \$0.** Use free tiers only. Do not
add a payment method, enable paid upgrades, consumption billing, paid
add-ons, or automatic upgrades. If a free quota is exhausted, allow the
service to become temporarily unavailable rather than incur charges.
Recheck provider terms before deployment because free-tier policies can
change.

------------------------------------------------------------------------

## 1. Employer assignment requirements

Objective: collect and manage user feedback.

Required: - Feedback form with name, email, and message. - List of
feedback entries. - Filter by keyword and date. - Delete feedback with
confirmation. - Backend is required; this must be a real full-stack
application. - Submit through a GitHub repository link.

Employer's engineering expectations: - Best practices for naming,
commenting, and file separation. - Suggested structure:
`src/components/`, `src/pages/`, `src/services/`, `src/utils/`,
`src/assets/`, `App.js`, and `index.js`. - PascalCase for React
component names (e.g. `FeedbackForm.jsx`). - camelCase for variables and
functions (e.g. `handleSubmit`). - kebab-case for non-component
filenames where appropriate. - Inline comments for non-obvious logic. -
JSDoc-style comments for meaningful functions, documenting parameters
and return values. - Any CSS framework is allowed.

Do not omit these requirements when adding the improvements below.

## 2. Product direction

Build two experiences:

1.  **Public submission page:** visitors submit feedback.
2.  **Protected admin dashboard:** an authenticated admin reviews,
    searches, filters, paginates, analyses, exports, and deletes
    feedback.

Principles: - Functionality, correctness, security, and explainability
before visual effects. - Simple, readable, idiomatic JavaScript. - No
unnecessary abstractions, global state library, microservices, excessive
custom hooks, excessive `useMemo`/`useCallback`, or decorative charts. -
Use dependencies only when they solve a real need. - Do not add
unapproved features. - Do not fabricate production data. - The developer
must be able to explain every important file, component, hook, function,
API, and query. - Use a restrained professional identity inspired by
Penthara Technologies. Do not copy a logo, claim this is an official
internal Penthara product, or invent official brand colours. If no
verified brand assets/palette are supplied, use a neutral corporate
palette with one restrained accent.

## 3. Confirmed technology stack

Frontend: - React with Vite. - Tailwind CSS. - React Router only if
needed for public/admin pages. - Fetch API by default; use Axios only
with a clear reason. - A lightweight chart library for agreed charts. -
A consistent icon set if icons are used.

Backend: - Node.js + Express.js. - REST API. - `mysql2` promise API and
connection pool. - bcrypt/bcryptjs for password hashing. - JWT in an
HTTP-only cookie for admin authentication. - Express rate limiting. -
Cloudflare Turnstile with server-side Siteverify verification. - Simple
explicit validation functions or a lightweight validation library.

Database: - Cloud-hosted MySQL-compatible TiDB Cloud Starter. - Use
MySQL protocol with `mysql2`. - Prefer standard MySQL-compatible SQL and
test against the actual hosted instance. - Do not rely on
vendor-specific features without documenting why.

Deployment plan --- free tiers only: - Render Free Web Service runs
Express. - Express serves the production React build as static files and
handles `/api` on the same origin. This keeps cookie authentication
same-origin and avoids cross-site cookie complexity. - TiDB Cloud
Starter hosts the MySQL-compatible database. - Cloudflare Turnstile Free
handles CAPTCHA. - Use the free provider subdomain; do not buy a custom
domain.

Zero-cost caveats: - Do not add payment methods to Render or TiDB. - Do
not enable consumption billing, paid fallback, or paid upgrades. - TiDB
free quota exhaustion should throttle/deny operations; do not enable
paid usage. - Render free services sleep after inactivity and may
cold-start. They have monthly usage/bandwidth limits. Without a payment
method, over-limit usage can suspend services rather than bill. - Free
hosting is suitable for an assignment/demo, not a production
availability guarantee. - Do not use Render's free Postgres; this
project requires MySQL. - Do not use Vercel Hobby as the default because
its terms restrict it to personal/non-commercial use. - No paid email,
SMS, analytics, storage, domain, monitoring, or CAPTCHA products. - If
provider policies change, stop and ask before selecting a paid
alternative.

Official plan references checked during planning: - Cloudflare Turnstile
plans: https://developers.cloudflare.com/turnstile/plans/ - TiDB Cloud
Starter tiers: https://docs.pingcap.com/tidbcloud/select-cluster-tier/ -
TiDB free-tier quotas:
https://docs.pingcap.com/tidbcloud/serverless-faqs/ - Render free
deployment: https://render.com/docs/free - Render outbound bandwidth:
https://render.com/docs/outbound-bandwidth - Cloudflare Pages limits
(not the chosen app host):
https://developers.cloudflare.com/pages/platform/limits/ - Vercel Hobby
restrictions: https://vercel.com/docs/plans/hobby

## 4. Users and permissions

Public visitor can: - Open the public form. - Enter name, email,
feedback type, rating, and message. - Complete Turnstile. - Submit and
see success/error feedback.

Public visitor cannot: - List or read all feedback. - View admin
statistics. - Delete feedback. - Export feedback. - Access admin
endpoints.

Admin can: - Log in/log out. - View statistics and charts. - Browse,
search, filter, sort, and paginate feedback. - Delete feedback after
confirmation. - Export matching feedback to CSV.

Enforce access in backend middleware. Hiding a button in React is not
authorization.

## 5. Feature requirements

### 5.1 Public form

Required inputs: name, email, message.

Additional agreed inputs: - Feedback type, from fixed allowlist: General
feedback, Bug report, Feature request, Complaint, Appreciation, Other. -
Five-level illustrated face rating, stored as integer 1--5: 1. Very poor
2. Poor 3. Neutral 4. Good 5. Excellent - Cloudflare Turnstile CAPTCHA.

Name: - Required, trim leading/trailing whitespace, max 100
characters. - Allow ordinary spaces, apostrophes, hyphens, and Unicode
names. - Reject empty/whitespace-only values and inappropriate control
characters.

Email: - Required, trim whitespace, validate reasonable email syntax
server-side. - Document normalization/case handling. - Syntax validation
does not prove mailbox ownership.

Feedback type: - Validate against the fixed allowlist on the backend.

Rating: - Exactly one selection, integer 1--5. - Use consistent SVG/icon
illustrations rather than platform-dependent emoji glyphs. - Provide
accessible text labels and keyboard interaction. - Persist the numeric
rating, not emoji text.

Message: - Required, trim outer whitespace, recommended maximum 1,000
characters. - Preserve normal punctuation and Unicode. - Never render as
raw HTML. - Optional character counter.

Prewritten feedback suggestions: - Show optional, editable feedback
statements selected by feedback type and rating when the message textarea
receives focus. - Filter the local suggestions as the user types; selecting
one inserts editable text. - Allow fully custom feedback without choosing a
suggestion. - Support pointer and practical keyboard navigation, and close the
list on outside click, Escape, or form submission. - Suggestions are natural
feedback content, not questions, AI-generated prompts, or chatbot responses.
- Keep statements in a maintainable local data file; do not use an AI API or
paid external generation service.

Submission: - Client validation for usability and server validation for
security. - Server verifies Turnstile token with Cloudflare Siteverify;
secret stays in backend environment. - Prevent accidental duplicate
clicks while pending. - On success, show confirmation and reset
fields/rating/widget. - On failure, preserve entered data where safe and
show a useful message. - Never expose database errors or secrets.

### 5.2 Admin dashboard

Statistics: - Total feedback. - Today's feedback. - This calendar week's
feedback (Monday--Sunday) using one documented timezone. - Calculate
from database; no separate counter table.

Charts (two or three meaningful charts): - Feedback volume over time. -
Rating distribution (1--5). - Feedback type distribution if it adds
value. - Use real API data, labels, empty states, responsive layout, and
accessible text summaries. - Do not use decorative or fabricated charts.

### 5.3 Feedback management

Each item displays name, email, type, rating/label, message preview,
submission date/time, and delete action.

Features: - Newest first by default. - Keyword search across name,
email, and message. - Date range filter. - Feedback type filter. -
Rating filter. - Newest/oldest sorting. - Server-side pagination. -
Clear filters. - Loading, empty, and error states. - Delete confirmation
identifies the record.

Do not fetch every record and paginate only in React. Filtering,
counting, sorting, and pagination belong on the backend/database.

### 5.4 Date filtering

-   Start date and end date.
-   Validate both dates and ensure start \<= end.
-   Document timezone and date boundaries.
-   End date is inclusive.
-   Prefer a half-open SQL interval: start at beginning of start date,
    end before the day after end date.
-   Allow combined keyword/type/rating/date filters.
-   Clearing filters resets query state and page to 1.

### 5.5 Pagination

-   Server-side.
-   Default 10 records per page.
-   Optional allowed page sizes: 10, 20, 50.
-   Validate page/limit.
-   Return current page, limit, total matching records, total pages.
-   Reset to page 1 when filters change.
-   Handle out-of-range pages after deletion.

### 5.6 Delete

-   Admin-only.
-   UI confirmation identifies selected record.
-   Permanent deletion for initial version.
-   Parameterized delete query.
-   Return 404 if no record exists.
-   Refresh list/statistics after success.
-   No public delete endpoint.

### 5.7 CSV export

-   Admin-only.
-   Start/end date selection.
-   Export all matching records, not just current page.
-   Include name, email, feedback type, numeric rating, rating label,
    message, timestamp.
-   Validate range and set a sensible maximum range/row cap.
-   Neutralize CSV formula injection for values beginning with `=`, `+`,
    `-`, `@`, tab, or carriage return.
-   Correctly escape commas, quotes, and newlines.
-   Correct content type and attachment filename.
-   Do not store exported files on server.
-   Document no-match behaviour.

### 5.8 Responsive/accessibility

-   Public form and dashboard work on mobile, tablet, desktop.
-   No horizontal overflow.
-   Use readable cards/compact layout on narrow screens instead of
    forcing wide tables.
-   Visible form labels, keyboard access, focus states, readable errors.
-   Face ratings accessible by keyboard and screen readers.
-   Modal has title, keyboard behaviour, and sensible focus handling.
-   Charts are not the only way to understand metrics.
-   Minimal motion; respect reduced-motion preference.

## 6. Database design

Use two tables only: `feedback` and `admins`.

### `feedback`

  Column            Type                 Rules
  ----------------- -------------------- -----------------------------
  `id`              INT UNSIGNED         Primary key, auto increment
  `name`            VARCHAR(100)         NOT NULL
  `email`           VARCHAR(255)         NOT NULL
  `feedback_type`   VARCHAR(40)          NOT NULL, backend allowlist
  `rating`          TINYINT UNSIGNED     NOT NULL, 1--5
  `message`         TEXT                 NOT NULL
  `created_at`      DATETIME/TIMESTAMP   NOT NULL, UTC

Indexes: - Primary key `id`. - Index `created_at` for date
filtering/statistics. - Add other indexes only if query patterns/EXPLAIN
justify them. - `%term%` multi-column keyword search may not use
ordinary B-tree indexes; keep implementation appropriate for assignment
scale.

### `admins`

  Column            Type                 Rules
  ----------------- -------------------- -----------------------------
  `id`              INT UNSIGNED         Primary key, auto increment
  `email`           VARCHAR(255)         NOT NULL, UNIQUE
  `password_hash`   VARCHAR(255)         NOT NULL
  `created_at`      DATETIME/TIMESTAMP   NOT NULL

No plaintext password. No public admin registration. Provide safe
one-time admin initialisation using environment variables or a
documented setup command. Never commit production credentials.

Database rules: - Store timestamps consistently in UTC; convert for
display. - Use `mysql2` connection pooling. - Parameterize all
user-controlled values. - Use transactions only when atomic multi-step
operations require them. - Do not store JWT secrets, CAPTCHA tokens, or
plaintext passwords in feedback rows. - Include `schema.sql` and setup
instructions. - Handle DB unavailability safely without leaking
connection or SQL details.

## 7. Backend architecture

Suggested structure:

``` text
server/
  src/
    config/
      database.js
      env.js
    routes/
      feedbackRoutes.js
      adminRoutes.js
      authRoutes.js
    controllers/
      feedbackController.js
      adminController.js
      authController.js
    services/
      feedbackService.js
      dashboardService.js
      authService.js
      captchaService.js
    middleware/
      authenticateAdmin.js
      validateRequest.js
      rateLimiter.js
      errorHandler.js
    utils/
      validation.js
      dateRange.js
      csv.js
    app.js
    server.js
  sql/
    schema.sql
  package.json
  .env.example
```

Responsibilities: - `database.js`: MySQL pool, connection settings,
provider TLS. - `env.js`: validate required environment variables at
startup; safe errors. - Routes: map paths/methods to middleware and
controllers. - Controllers: parse request, call services, send
status/JSON/CSV; no SQL. - Services: business logic and parameterized
database operations. - `authenticateAdmin.js`: verify JWT cookie and
attach admin identity. - `validateRequest.js`: reusable request
validation where useful. - `rateLimiter.js`: separate policies for login
and public submission. - `errorHandler.js`: central safe error
responses; no stack traces or SQL details to clients. - `validation.js`:
name/email/type/rating/message/date/pagination validators. -
`dateRange.js`: consistent date parsing and inclusive end-date
handling. - `csv.js`: safe CSV serialization and formula
neutralization. - `app.js`: middleware, routes, production static build
serving, SPA fallback. - `server.js`: start server and handle shutdown.

Style: - async/await. - Small controller functions. - SQL in service
modules. - Avoid giant controllers and unnecessary class hierarchies. -
JSDoc on meaningful exported functions. - Comments explain non-obvious
logic/security choices only.

## 8. Frontend architecture

Suggested structure:

``` text
client/
  src/
    components/
      FeedbackForm.jsx
      FeedbackTypeSelect.jsx
      FaceRating.jsx
      SuggestedMessage.jsx
      TurnstileWidget.jsx
      FeedbackList.jsx
      FeedbackItem.jsx
      FilterBar.jsx
      Pagination.jsx
      ConfirmDeleteModal.jsx
      StatCard.jsx
      FeedbackCharts.jsx
      LoadingState.jsx
      EmptyState.jsx
      ErrorMessage.jsx
    pages/
      PublicFeedbackPage.jsx
      AdminLoginPage.jsx
      AdminDashboardPage.jsx
    services/
      api.js
      feedbackService.js
      adminService.js
      authService.js
    hooks/
      (only meaningful reusable stateful logic)
    utils/
      validators.js
      formatDate.js
      ratingLabels.js
    assets/
      faces/
    App.jsx
    main.jsx
```

Component responsibilities: - `FeedbackForm`: form values, validation
display, submission state; delegates type/rating/CAPTCHA controls. -
`FeedbackTypeSelect`: allowed types. - `FaceRating`: accessible
one-of-five rating, returns numeric value. - `SuggestedMessage`:
context-aware editable feedback statements based on type/rating, filtered
locally as the visitor types. -
`TurnstileWidget`: render widget and provide token; reset when needed. -
`FeedbackList`: current page list and list states. - `FeedbackItem`: one
feedback record and delete action. - `FilterBar`:
keyword/date/type/rating/sort filters. - `Pagination`: page navigation
and optional page size. - `ConfirmDeleteModal`: clear delete
confirmation and focus handling. - `StatCard`: one statistic. -
`FeedbackCharts`: real chart data and accessible labels. -
`LoadingState`, `EmptyState`, `ErrorMessage`: reusable UI states. -
`PublicFeedbackPage`: compose public experience. - `AdminLoginPage`:
login and error handling. - `AdminDashboardPage`: stats, charts,
filters, list, pagination, export.

Do not create components just to inflate file count. Keep simple logic
local where appropriate.

### Hooks guidance

-   `useState`: form fields, rating/type, filters, modal, loading/error
    state.
-   `useEffect`: fetch data when page/filters change; prevent stale
    requests and clean up where needed.
-   `useCallback`: only when stable callback identity is actually
    needed.
-   `useMemo`: only for genuinely expensive derived values; do not
    duplicate server filtering in the browser.
-   `useRef`: only for actual imperative needs such as widget references
    or focus management.
-   Custom hooks: only if they encapsulate meaningful reusable stateful
    behaviour. Explain inputs, outputs, dependencies, and cleanup.
-   No global state library unless real complexity proves it necessary.

Frontend services: - `api.js`: same-origin request handling,
credentials, JSON parsing, common errors. - `feedbackService.js`:
submit/list/delete/export calls. - `adminService.js`: stats/charts
calls. - `authService.js`: login/logout/current session.

Keep fetch/network calls out of presentation components where practical.

## 9. REST API contract

All JSON APIs use `/api`. Use consistent safe error shape,
e.g. `{ success: false, message, errors? }`.

### Public

`POST /api/feedback`

Body: - `name` - `email` - `feedbackType` - `rating` - `message` -
`turnstileToken`

Flow: 1. Rate limit. 2. Validate all fields, lengths, allowlisted type,
rating 1--5. 3. Verify token with Cloudflare Siteverify using backend
secret. 4. Insert via parameterized SQL. 5. Return created metadata, not
internals.

Statuses: 201 success, 400 invalid input, 429 rate limited, safe 502/503
for CAPTCHA provider failure/rejection, 500 unexpected error.

### Authentication

`POST /api/auth/login` - Accept email/password. - Rate limit. -
Parameterized admin lookup. - bcrypt compare. - Generic
invalid-credentials response. - Set JWT in HTTP-only cookie; never
return token in JSON or store in localStorage/sessionStorage. - `Secure`
in production, `SameSite=Lax` for same-origin, appropriate path and
expiry.

`POST /api/auth/logout` - Clear cookie with matching options.

`GET /api/auth/me` - Require authentication. - Return minimal admin
identity only.

### Admin feedback

All require `authenticateAdmin`.

`GET /api/admin/feedback` Query: - `keyword` - `startDate` - `endDate` -
`feedbackType` - `rating` - `sort` (`newest`/`oldest`) - `page` -
`limit` (allowlist 10/20/50)

Return `data` plus `pagination` with currentPage, limit, totalRecords,
totalPages.

Use parameterized values. SQL sort identifiers/direction must come from
a strict server-side allowlist, not raw user strings.

`GET /api/admin/feedback/:id` (optional if detail view retained):
validate ID, 404 if missing.

`DELETE /api/admin/feedback/:id`: admin-only, parameterized, 404 if no
row, clear success response.

### Dashboard

`GET /api/admin/dashboard/stats` - `totalFeedback` - `todayFeedback` -
`thisWeekFeedback`

Use Monday--Sunday week and one documented timezone.

`GET /api/admin/dashboard/charts` - feedback volume over time - rating
distribution - feedback type distribution - compact bounded result sets.

### CSV

`GET /api/admin/feedback/export` - Admin-only. - Date range and relevant
filters. - All matching rows, not current page only. - Sensible
row/window cap. - Safe CSV serialization and formula-injection
neutralization. - Correct content type and attachment filename.

## 10. Security requirements

These controls are distinct:

1.  **Validation:** type, format, length, allowlist, range.
2.  **Normalization:** trim and consistently handle values.
3.  **Sanitization:** context-specific only; do not blindly strip
    punctuation/special characters from ordinary feedback.
4.  **SQL parameterization:** `mysql2` placeholders for all
    user-controlled values; never concatenate input into SQL.
5.  **Output safety:** render feedback as text; never use
    `dangerouslySetInnerHTML` for feedback.

Required protections: - Server-side validation on every input. -
Allowlist feedback types, ratings, sort values, page sizes. -
Parameterized SQL for every user-controlled value. - React text
rendering; no raw HTML. - Server-side Turnstile verification; secret
only in backend environment. - Rate limiting on public submission and
login. - Admin authentication and authorization on every admin
endpoint. - bcrypt password hashing. - Secure random JWT secret in
environment. - HTTP-only cookie, Secure in production, SameSite=Lax for
same-origin. - Helmet/security headers. - JSON body size limit. -
Generic client errors; no stack traces, SQL errors, credentials, or
tokens. - CSV formula-injection protection. - No secrets in Git or
frontend bundles. `VITE_` variables are public. - Avoid logging
passwords, JWTs, CAPTCHA tokens, or unnecessary personal data. - HTTPS
in deployment and database TLS. - CAPTCHA is not a replacement for rate
limiting. - Because cookies are sent automatically, decide and document
a simple CSRF/origin protection for state-changing admin requests
(e.g. strict Origin checking for same-origin deployment or a CSRF token
approach). - Reject expired/invalid JWTs; logout clears cookie.

## 11. Environment variables

Create `.env.example` with names/placeholders only. Never commit `.env`.

Expected backend variables: - `NODE_ENV` - `PORT` - `DB_HOST` -
`DB_PORT` - `DB_USER` - `DB_PASSWORD` - `DB_NAME` - provider TLS
configuration (`DB_SSL` or documented options) - `JWT_SECRET` -
`JWT_EXPIRES_IN` - `ADMIN_EMAIL` / `ADMIN_PASSWORD` only for one-time
safe initialisation - `TURNSTILE_SECRET_KEY` - `TURNSTILE_SITE_KEY`
(public site key only) - `APP_ORIGIN` if used for Origin checks

Fail fast on missing required configuration. Never place server secrets
in Vite/client environment variables.

## 12. Errors and HTTP statuses

Use consistent safe JSON errors: - `success: false` - `message` -
optional field-level `errors`

Statuses: - 200 successful read/update. - 201 created. - 204 delete
without body, or 200 with confirmation. - 400 invalid input. - 401
unauthenticated. - 403 authenticated but forbidden. - 404 missing
resource. - 409 genuine conflict. - 429 rate limited. - 500 unexpected
server error. - 502/503 upstream CAPTCHA/database availability issue
where appropriate.

Never expose stack traces, SQL text, connection strings, or secret
values.

## 13. Testing and acceptance checklist

Public: - Valid submission persists and appears in admin. -
Missing/invalid/overlong fields rejected. - Unsupported type and rating
outside 1--5 rejected. - Missing/invalid Turnstile token rejected. -
Provider failure handled safely. - Rapid repeated requests
rate-limited. - Unicode and ordinary punctuation preserved. -
HTML/script-like message is displayed as text, not executed. - Double
click does not accidentally create duplicate submissions.

Admin: - Unauthenticated admin endpoints rejected. - Login sets
HTTP-only cookie. - Invalid login generic. - Logout clears cookie. -
Invalid/expired JWT rejected. - Search covers name/email/message. - Date
range includes full end date. - Combined filters work. - Pagination
count reflects matching records. - Invalid sort/limit rejected. - Delete
confirmation and authorization work. - Missing record returns 404. -
Statistics match DB records and timezone/week boundaries. - CSV respects
filters/date range. - CSV handles quotes/commas/newlines/Unicode and
formula-like cells safely.

Quality: - Responsive mobile/tablet/desktop. - No normal-flow console
errors. - Loading/empty/error/success states clear. - No committed
secrets. - Production build succeeds. - README setup works from clean
checkout.

## 14. Repository structure

``` text
feedback-collector/
  client/
    src/
      components/
      pages/
      services/
      hooks/
      utils/
      assets/
      App.jsx
      main.jsx
    package.json
  server/
    src/
      config/
      routes/
      controllers/
      services/
      middleware/
      utils/
      app.js
      server.js
    sql/
      schema.sql
    package.json
    .env.example
  docs/
    ARCHITECTURE.md
    API.md
    DECISIONS.md
  .gitignore
  README.md
  PROJECT_SPEC.md
```

The employer's suggested `src/` separation is reflected in the client.
The backend has a similarly clear separation.

## 15. Naming and comments

-   Components: PascalCase (`FeedbackForm.jsx`).
-   Functions/variables: camelCase (`handleSubmit`, `feedbackList`).
-   Database columns: snake_case (`created_at`, `feedback_type`).
-   Non-component filenames: kebab-case or clear camelCase,
    consistently.
-   Descriptive names; avoid vague names like `temp`, `thing`, or
    generic `data` where a precise name is easy.
-   JSDoc for meaningful exported/service functions with useful `@param`
    and `@returns`.
-   Inline comments only for non-obvious logic, security decisions,
    timezone handling, or tricky cases.
-   Do not comment every line or restate obvious code.
-   Keep functions focused and avoid one-use generic abstractions.

## 16. Learning and explanation requirements

The developer must be ready to walk the CEO/technical team through the
actual code.

For each component explain: - What it displays/controls. - Props and
their purpose. - Local state. - Events/callbacks. - Parent/service
communication.

For each hook explain: - Why it is used. - What state/value it
manages. - What triggers effects. - Dependencies and cleanup. - Why
built-in/custom hook choice is appropriate.

For each important function explain: - Responsibility. - Parameters and
return. - Caller/module. - Error cases. - Security-sensitive behaviour.

For each API explain: - Method/path. - Auth requirement. - Request
body/query. - Validation. - Service/database action. - Success/error
response.

For each important SQL query explain: - Tables accessed. -
Returned/changed data. - Placeholder use. - Date boundaries, sorting,
and pagination.

Maintain: - `docs/ARCHITECTURE.md`: data flow and module
responsibilities. - `docs/API.md`: API contract. - `docs/DECISIONS.md`:
decisions and reasons. - `README.md`: overview, features, stack,
prerequisites, local setup, env vars, DB setup, scripts, deployment,
security, free-tier limitations.

Explain each phase immediately after it is implemented and tested. Do
not dump a giant explanation at the end.

## 17. Mandatory phase-by-phase workflow for Codex

At the beginning of each phase: state goal and files to be changed. At
the end: run checks/tests, summarise files, explain code, report
acceptance status and known issues, then wait for approval.

### Phase 0 --- Inspect and plan

-   Inspect repository, existing files, framework, package manager,
    configuration.
-   Compare with this specification.
-   Propose exact structure and plan.
-   Identify unresolved questions.
-   Do not write application code before approval.

### Phase 1 --- Scaffolding

-   Vite + React, Express, Tailwind, scripts, env loading, `.gitignore`,
    `.env.example`, health endpoint.
-   Verify client/server start.
-   Explain entry points and scripts.
-   Stop for approval.

### Phase 2 --- MySQL

-   Configure mysql2 pool and TiDB TLS.
-   Add `feedback` and `admins` schema.
-   Test parameterized insert/select.
-   Explain pool, schema, indexes, placeholders.
-   Stop for approval.

### Phase 3 --- Public backend/security

-   Validation, Turnstile Siteverify, rate limiting, parameterized
    insert, safe errors.
-   Test success and invalid cases.
-   Explain validation vs
    normalization/sanitization/parameterization/output safety.
-   Stop for approval.

### Phase 4 --- Admin authentication

-   Safe admin initialisation, bcrypt, login/logout/me, JWT cookie,
    middleware, Origin/CSRF decision.
-   Test protected routes and invalid/expired sessions.
-   Stop for approval.

### Phase 5 --- Admin feedback APIs

-   Keyword/date/type/rating/sort filters, server-side pagination,
    delete, optional detail.
-   Test combined filters and edge cases.
-   Explain SQL/query allowlists/counts/pagination.
-   Stop for approval.

### Phase 6 --- Statistics and charts APIs

-   Total/today/this-week counts, grouped chart data, timezone
    boundaries.
-   Test against known sample rows.
-   Stop for approval.

### Phase 7 --- Public React

-   Form, face rating, type, suggested prompts, Turnstile, API
    integration, validation and states.
-   Test accessibility and responsive behaviour.
-   Explain components/hooks.
-   Stop for approval.

### Phase 8 --- Admin React

-   Login, protected dashboard, stats, charts, list, filters,
    pagination, delete confirmation.
-   Integrate APIs and states.
-   Test UI and API permissions.
-   Explain components/state/effects/services.
-   Stop for approval.

### Phase 9 --- CSV export

-   Protected export, filters/date range, CSV escaping/formula
    protection, frontend controls.
-   Test tricky cell values.
-   Stop for approval.

### Phase 10 --- Integration and QA

-   End-to-end public-to-DB-to-admin flow.
-   Test search, filters, pagination, delete, stats, export, security,
    and responsive layouts.
-   Remove dead code and unused dependencies.
-   Stop for approval.

### Phase 11 --- Free deployment and documentation

-   Render Free serves Express and React build on same origin.
-   TiDB Cloud Starter with no payment method/paid usage.
-   Cloudflare Turnstile Free.
-   Configure environment variables, provider hostname, HTTPS, cookies,
    DB TLS.
-   Verify complete flows.
-   Document cold starts/quotas.
-   Confirm no paid features or billing enabled.
-   Prepare GitHub and README.
-   Stop for approval.

### Phase 12 --- CEO walkthrough

Prepare a concise walkthrough: 1. Problem and objective. 2. Public
submission demo. 3. Validation and CAPTCHA. 4. React → Express → MySQL
flow. 5. Admin login. 6. Statistics/charts/search/filter/pagination. 7.
Delete and CSV export. 8. Folder structure. 9. Authentication,
parameterized SQL, rate limiting, XSS and CAPTCHA protections. 10.
Trade-offs, free-tier limitations, and future improvements.

## 18. Codex CLI operating rules

1.  Read this entire file before acting.
2.  Inspect repository before creating or overwriting files.
3.  Do not assume the repository is empty.
4.  Do not overwrite working code without explaining why.
5.  Follow phases exactly and wait for approval between phases.
6.  Explain dependencies before installing them.
7.  Do not silently change stack, scope, or architecture.
8.  Never use paid APIs/services or enable paid plans.
9.  Never invent credentials, environment values, or database details.
10. Never put secrets in source code or frontend bundles.
11. Use simple idiomatic JavaScript unless TypeScript is explicitly
    approved later.
12. Avoid unnecessary code, libraries, and abstractions.
13. Run relevant tests/build/lint checks and report anything not run.
14. Explain created files and important functions/components/hooks in
    plain language.
15. Maintain an acceptance checklist; mark complete only after testing.
16. If requirements or free-tier policy are ambiguous, stop and ask.

After every phase, report: - Goal. - Files changed and purpose. -
Implementation/data flow. - Important components/functions/hooks. -
Security considerations. - Tests/commands and results. - Acceptance
checklist (pass/fail/not tested). - Known limitations. - Proposed next
phase (do not start until approved).

## 19. Definition of done

Complete only when: - Employer-required features work. - Public form
stores name/email/message plus type/rating. - Turnstile is verified
server-side. - Admin login and authorization work. - Admin can
list/search/filter/sort/paginate/delete with confirmation. - Statistics
and charts use real database data. - CSV export respects filters/date
range and is formula-injection-safe. - SQL is parameterized. -
Validation, output safety, rate limiting, and secure secrets are
implemented. - Core experiences are responsive and accessible. - No
secrets are committed. - README/setup/deployment documentation is
usable. - Deployment uses free tiers only, without payment method or
paid usage. - Developer can explain architecture, code paths, database
queries, security controls, and trade-offs.

**Final principle:** Build the smallest complete, secure solution that
satisfies the assignment. Prefer understandable code and verified
behaviour over feature count, visual complexity, or unnecessary
abstraction.
