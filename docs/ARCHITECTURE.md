# Architecture

The application uses React with Vite for the browser UI and Express for the
REST API. During local development, Vite proxies `/api` requests to Express.
For production, Express serves the built React app and SPA routes from the same
origin as the API; root `npm run build` and `npm start` are the deployment
commands. The API is same-origin, so no production CORS policy is needed.
The backend connects through Neon's pooled PostgreSQL URL using the `pg` pool:

```text
React browser → Vite /api proxy → Express REST API → pg connection pool → Neon PostgreSQL
```

The frontend never connects directly to PostgreSQL and never receives database
credentials. Runtime configuration comes from `DATABASE_URL` in the ignored
root `.env.local`; schema initialization uses the direct `DATABASE_URL_UNPOOLED`
value. The pool is bounded to five connections and validates the URL before
server startup. PostgreSQL `TIMESTAMPTZ` stores instants consistently; reports
and date filters explicitly use UTC boundaries, independent of session display
timezone.

`server/sql/postgres-schema.sql` creates the `feedback` and `admins` tables in
the already-provisioned database. The repeatable `db:init` script uses the
unpooled URL and does not create a database or Neon service. The original
`server/sql/schema.sql` and local MySQL database are retained as a fallback
after the verified data migration; application runtime does not connect to
MySQL.

The API exposes `GET /api/health` as a lightweight process check. Public
submissions follow this path:

```text
POST /api/feedback → rate limit → validate/normalize → Cloudflare Siteverify → parameterized PostgreSQL insert
```

The React public form validates the same fields for usability, sends feedback
to the same-origin `/api/feedback` route, and renders Turnstile using only its
public site key. CAPTCHA secrets remain in the server environment. Provider
failures and database failures return safe errors.

Admin login remains application-level and uses bcrypt with 12 rounds, an HS256
JWT in an HttpOnly, SameSite=Lax cookie, and exact Origin checks on
state-changing auth requests. Neon Auth is disabled. Protected feedback routes
apply validated keyword/date/type/rating filters in parameterized PostgreSQL
queries, count before server-side pagination, select sort clauses from a fixed
allowlist, and require same-origin protection for deletion. Dashboard queries
use UTC day boundaries and return bounded datasets: 30 daily counts, five
ratings, and six feedback types. CSV and XLSX exports reuse those filters and
sorting without list pagination; CSV quotes cells and neutralizes spreadsheet
formulas, while XLSX provides styled headers, column widths, and a frozen
header row.
