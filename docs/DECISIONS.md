# Decisions

## Client and server workspaces

The repository uses npm workspaces so the React client and Express server
remain separately organized while sharing one root package lockfile.

## Same-origin API path

The client uses relative `/api` URLs. Vite proxies that path in development;
the production server can serve the client and API from one origin to support
HTTP-only cookie authentication.

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
database. Timestamps use UTC `DATETIME` values for consistent filtering and
display.
