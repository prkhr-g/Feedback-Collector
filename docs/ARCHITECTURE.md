# Architecture

The application uses React with Vite for the browser UI and Express for the
REST API. During local development, Vite proxies `/api` requests to Express.
The data flow is:

```text
React browser → Express REST API → mysql2 connection pool → local MySQL
```

The frontend never connects directly to MySQL and never receives database
credentials. `server/src/config/database.js` reads connection settings from
environment variables and creates one bounded promise-based connection pool.
The server checks required database settings and a connection at startup.

`server/sql/schema.sql` creates the `feedback_collector` database and the two
application tables: `feedback` and `admins`. Timestamps are stored as UTC
`DATETIME` values. The pool sets `time_zone` to `+00:00` on every connection
acquisition, including reuse, before application queries run. mysql2's
`timezone: 'Z'` option separately handles JavaScript date serialization and
parsing. Database date queries must use UTC boundaries.

The API exposes `GET /api/health` as a lightweight process check. Public
submissions follow this path:

```text
POST /api/feedback → rate limit → validate/normalize → Cloudflare Siteverify → parameterized MySQL insert
```

The React public form validates the same fields for usability, sends feedback
to the same-origin `/api/feedback` route, and renders Turnstile using only its
public site key. Its name, email, category, face rating, editable prompt, and
message remain in React state until a successful submit. Loading, validation,
success, network, and API failure states are announced accessibly.

CAPTCHA secrets remain in the server environment. Provider failures and
database failures return safe errors. Admin login uses bcrypt with 12 rounds,
an HS256 JWT in an HttpOnly, SameSite=Lax cookie, and exact Origin checks on
state-changing auth requests. `/api/auth/me` checks the session and returns
only the admin ID and email. Protected feedback management routes apply validated
keyword/date/type/rating filters in parameterized MySQL queries, count before
server-side pagination, choose sort clauses from a fixed allowlist, and
require same-origin protection for permanent deletion. Protected dashboard
APIs use UTC day boundaries, count Monday-through-current-day UTC week volume,
and return bounded chart datasets: 30 daily counts, five ratings, and six
feedback types. The protected CSV export reuses those validated filters,
ignores page size, caps retrieval at 10,001 rows before rejecting over-cap
exports, quotes CSV cells, and neutralizes spreadsheet formulas. The React admin application checks `/api/auth/me` on entry,
uses the HttpOnly cookie for protected calls, and keeps filter, paging, and
dashboard state in component state rather than browser storage.
