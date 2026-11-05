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
`DATETIME` values; database date queries must use UTC boundaries.

The API currently exposes `GET /api/health` as a lightweight process check.
Feedback, authentication, and dashboard modules will be added in their
approved project phases.
