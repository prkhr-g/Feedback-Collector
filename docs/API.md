# API

## Health

`GET /api/health` is public and returns `{ "success": true, "status": "ok" }`
when the Express process is running.

## Public feedback

### `POST /api/feedback`

Public endpoint. The server rate-limits requests by client IP before parsing
the JSON body, validates and normalizes the fields, verifies the Turnstile
token with Cloudflare Siteverify, then inserts the record with parameterized
SQL.

Request JSON:

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "feedbackType": "General feedback",
  "rating": 5,
  "message": "The service was helpful.",
  "turnstileToken": "token-from-the-widget"
}
```

Email is trimmed and lowercased before storage. Name and message are trimmed;
message text is otherwise preserved. Feedback type must be one of the six
allowlisted values and rating must be an integer from 1 to 5.

Success returns `201` with `{ "success": true, "data": { "id": 123 } }`.
Invalid fields or rejected CAPTCHA return `400`; malformed JSON returns `400`;
an oversized body returns `413`; rate limiting returns `429`; a Siteverify or
database availability failure returns a safe `503`; unexpected errors return
a generic `500`. Errors never include SQL, tokens, secrets, or stack traces.

The in-memory limiter allows five attempts per IP every fifteen minutes and
returns `RateLimit-*` headers plus `Retry-After` when limited.

The React form at `/` sends this request to the same-origin API. It includes
client-side validation and the Cloudflare Turnstile widget; the backend
remains authoritative for validation and token verification. Configure the
public widget key as `VITE_TURNSTILE_SITE_KEY` in `client/.env.local`.
The backend CSP permits Cloudflare's required script and frame origins as
described in the [Turnstile CSP guidance](https://developers.cloudflare.com/turnstile/reference/content-security-policy/).

## Admin authentication

### `POST /api/auth/login`

Requires an exact `Origin` match with `CLIENT_ORIGIN`. Accepts `{ "email":
"admin@example.com", "password": "..." }`. On success, sets an
`admin_session` HttpOnly, SameSite=Lax cookie scoped to `/api`, and returns
only the admin ID and email. Invalid credentials always return the same `401`
response. Login allows five attempts per IP in fifteen minutes.

### `GET /api/auth/me`

Requires a valid, unexpired session cookie. Returns the minimal admin ID and
email; otherwise returns `401`.

### `POST /api/auth/logout`

Requires an exact `Origin` match and clears the session cookie using the same
path and security attributes as login.

Initialize the first admin from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the
server-only environment by running `npm run admin:init --workspace server`.
There is no public registration endpoint. Password hashes currently use
bcrypt with 12 rounds. Legacy scrypt hashes are upgraded to bcrypt after a
successful login. Initial passwords must be at least 12 characters and no
more than 72 UTF-8 bytes.

## Admin feedback

All routes below require a valid admin session cookie.

### `GET /api/admin/feedback`

Lists feedback with server-side filtering and pagination. Supported query
parameters:

- `keyword`: up to 100 characters; searches name, email, and message as a
  literal substring (SQL wildcard characters are escaped).
- `startDate`, `endDate`: valid `YYYY-MM-DD` dates. Date boundaries use UTC;
  both ends are inclusive, implemented as a half-open SQL interval ending at
  midnight after `endDate`. Either bound may be omitted.
- `feedbackType`: one of the six public feedback types.
- `rating`: integer 1 through 5.
- `sort`: `newest` (default) or `oldest`; equal timestamps are ordered by ID.
- `page`: positive integer, defaults to 1.
- `limit`: 10 (default), 20, or 50.

Filters can be combined. Success returns `data` plus `pagination` with
`currentPage`, `limit`, `totalRecords`, and `totalPages`. If the requested
page exceeds the last page after filtering or deletion, the API returns the
last available page; an empty result uses page 1 and zero total pages.
Invalid filters return `400`.

### `GET /api/admin/feedback/export`

Downloads every matching record as `feedback-YYYYMMDD.csv`. It accepts the
same keyword, UTC date, feedback type, rating, and sort filters as the list
route; `page` and `limit` are ignored. Exports are capped at 10,000 rows and
return `422` when the filter matches more, so narrow the filters and retry.
CSV includes both the numeric rating and its label. It uses UTF-8 with a BOM,
quoted fields, CRLF rows, and formula neutralization for spreadsheet-leading
formula characters. Timestamps are rendered in UTC.
Invalid filters return `400`.

### `GET /api/admin/feedback/:id`

Returns one feedback record. Invalid IDs return `400`; missing records return
`404`.

### `DELETE /api/admin/feedback/:id`

Permanently deletes one record and requires an exact `Origin` match with
`CLIENT_ORIGIN` in addition to the admin session. Returns `404` when the
record does not exist.

These queries use bound parameters for all values. Sort clauses are selected
from fixed server-side SQL fragments. Count and page selection run in MySQL;
the server does not fetch all feedback to paginate in memory. Add API
integration fixtures with `npm run api:admin-feedback-test --workspace server`.
Verify protected CSV downloads and tricky cell values with
`npm run api:csv-test --workspace server`.

## Admin dashboard

Both dashboard endpoints require a valid admin session cookie.

### `GET /api/admin/dashboard/stats`

Returns `{ "success": true, "data": { "totalFeedback": 0,
"todayFeedback": 0, "thisWeekFeedback": 0 } }`. `todayFeedback` uses the
current UTC calendar day. `thisWeekFeedback` starts Monday at 00:00 UTC and
includes records through the current UTC day. These definitions make the
week Monday-to-Sunday while avoiding counting future dates in the current
week.

### `GET /api/admin/dashboard/charts`

Returns three bounded datasets in `data`:

- `feedbackVolume`: one `{ "date": "YYYY-MM-DD", "count": n }` item for
  each of the latest 30 UTC dates, including zero-count dates and today.
- `ratingDistribution`: five `{ "rating": 1, "count": n }` items, ratings
  1 through 5, including zero-count ratings.
- `feedbackTypeDistribution`: six `{ "feedbackType": "...", "count": n }`
  items for the supported feedback types, including zero-count types.

The statistics use conditional aggregates. Chart data is grouped in MySQL;
the API fills the bounded daily/rating/type result series with zeroes. All
date grouping and boundaries use UTC `DATETIME` values, consistent with the
database pool's UTC session configuration. Run known-row coverage with
`npm run api:dashboard-test --workspace server`.
