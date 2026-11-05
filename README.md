# Feedback Collector

A full-stack feedback collection application for the Penthara Technologies
selection assignment. The project is being built in approved phases. The
current scaffold includes a React/Vite client, an Express health endpoint,
and local MySQL schema and connection setup. Feedback and admin features are
added in later phases.

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

The actual initial admin creation command and production-grade Turnstile
configuration will be documented in their implementation phases. There is no
public admin registration route.

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
- Use local development keys only for Turnstile. Server-side Siteverify,
  authentication, and feedback security controls are implemented in later
  phases.
- The project is intended to be demonstrated locally. Cloud hosting and
  hosted databases are deferred unless explicitly requested.
- Admin initialization and the full feedback flow are not implemented yet.
