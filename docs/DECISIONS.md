# Decisions

## Client and server workspaces

The repository uses npm workspaces so the React client and Express server
remain separately organized while sharing one root package lockfile.

## Same-origin API path

The client uses relative `/api` URLs. Vite proxies that path in development;
the production server can serve the client and API from one origin to support
HTTP-only cookie authentication.

The public React form uses native form controls and local validation instead
of an additional form library. Feedback suggestions are deterministic starters
based on the selected type and rating; they never replace edited text unless
the user chooses to use the suggestion.

The admin React views call the existing same-origin APIs directly with the
browser's HttpOnly session cookie. JWTs stay out of JavaScript storage.
Filtering and pagination are sent to the server, and the permanent-delete
confirmation names the selected feedback before issuing the request.

## Local MySQL for the assignment

MySQL Community Server on the developer's computer is the default database
for the one-week assignment. The expected submission is a GitHub repository,
so a hosted database and public deployment are deferred. Database connection
settings remain environment-based so a later MySQL-compatible migration can
be evaluated without embedding credentials in source. Any live hosting or
hosted database choice requires the developer's explicit approval.

The backend uses `mysql2/promise` with a shared pool capped at five
connections. Local development uses the standard MySQL port and does not
require TLS. TLS remains configurable for a separately approved hosted
database. The pool executes `SET SESSION time_zone = '+00:00'` every time a
connection is acquired, so new and reused sessions evaluate
`CURRENT_TIMESTAMP` in UTC. mysql2's `timezone: 'Z'` setting handles JS Date
conversion; it does not set the MySQL session timezone. Timestamps use UTC
`DATETIME` values for consistent filtering and display.

## Admin authentication primitives

Admin sessions use an HS256 JWT in a scoped HttpOnly, SameSite=Lax cookie,
with exact Origin checks for state-changing requests. Passwords use bcrypt
with 12 rounds. Existing scrypt password hashes from the earlier Phase 4
implementation are verified during login and upgraded to bcrypt after
successful authentication.
