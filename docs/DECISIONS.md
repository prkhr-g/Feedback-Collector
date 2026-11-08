# Decisions

## Client and server workspaces

The repository uses npm workspaces so the React client and Express server
remain separately organized while sharing one root package lockfile.

## Same-origin API path

The client uses relative `/api` URLs. Vite proxies that path in development;
the production server can serve the client and API from one origin to support
HTTP-only cookie authentication.

The public React form uses native form controls and local validation instead
of an additional form library. Feedback suggestions are predefined statements
grouped by selected type and rating, filtered locally against the message text,
and inserted only when the visitor selects one. The inserted statement stays
editable; custom feedback never requires a suggestion.

The admin React views call the existing same-origin APIs directly with the
browser's HttpOnly session cookie. JWTs stay out of JavaScript storage.
Filtering and pagination are sent to the server, and the permanent-delete
confirmation names the selected feedback before issuing the request.

## Neon PostgreSQL migration

The currently approved deployment strategy replaces the app's local MySQL
runtime with Neon PostgreSQL, with Neon used only as a database. Neon Auth is
disabled; the existing application-level admin login, JWT cookie, password
hashing, and authorization remain in place. The frontend continues to call
the same Express API and preserves its current UI and features.

Runtime uses the pooled `DATABASE_URL` with the Node `pg` package and a bounded
five-connection pool. Repeatable schema setup uses
`DATABASE_URL_UNPOOLED`. Both values come from the ignored root `.env.local`
populated by the Neon CLI. Timestamps use PostgreSQL `TIMESTAMPTZ` and query
boundaries use UTC explicitly so report dates do not depend on session display
timezone.

The local MySQL database and `server/sql/schema.sql` remain untouched as a
fallback during the approved one-time data migration. The project must not
enable paid services, payment methods, or billing-based fallbacks.

## Admin authentication primitives

Admin sessions use an HS256 JWT in a scoped HttpOnly, SameSite=Lax cookie,
with exact Origin checks for state-changing requests. Passwords use bcrypt
with 12 rounds. Existing scrypt password hashes from the earlier Phase 4
implementation are verified during login and upgraded to bcrypt after
successful authentication.

## XLSX export dependency risk

ExcelJS 4.4.0 is retained for the protected XLSX export implementation. Its
transitive `uuid@8.3.2` dependency is affected by advisory
GHSA-w5hq-g745-h8pq (moderate severity), concerning UUID v3/v5/v6 buffer
bounds handling. Those affected code paths do not appear reachable through the
application's current ExcelJS usage, which generates workbooks and relies on
UUID v4 identifiers internally.

Downgrading ExcelJS or forcing a UUID override was rejected because of
compatibility and regression risks. This is an accepted, documented
dependency risk and must be reassessed before production deployment.
