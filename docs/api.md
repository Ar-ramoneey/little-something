# Response API

Server-only Vercel Functions for verifying invitations, submitting, changing, and reading Roqeebah's response, with durable Resend email notifications. The public frontend uses these endpoints through the relative paths documented below.

## Files

- `api/invitation/verify.ts` — canonical `POST /api/invitation/verify`, the invitation-code verification endpoint.
- `api/invitation.ts` — backward-compatible `POST /api/invitation` alias with identical behavior.
- `api/responses.ts` — `GET`, `POST`, and `PATCH /api/responses`.
- `api/admin/invitation.ts` — admin `GET`/`POST` invitation status and management.
- `api/admin/invitation/preview.ts` — admin `POST` that generates a code and previews the email without sending.
- `api/admin/invitation/send.ts` — admin `POST` that sends an explicitly confirmed invitation email.
- `api/admin/reset.ts` — admin `GET`/`POST` reset preview and atomic reset.
- `src/api/responses.ts` — browser service for the four public API calls.
- `src/api/admin.ts` — browser service for all admin endpoints; sends the Supabase access token as a Bearer header.
- `server/lib/*` — server-only helpers for env, validation, security, HTTP responses, Supabase, invitations, and notifications.
- `supabase/migrations/20261126000000_proposal_responses.sql` — responses, history, RLS.
- `supabase/migrations/20261126010000_invitation_sessions.sql` — sessions, rate limits, and atomic RPC functions.
- `supabase/migrations/20261126020000_response_notifications.sql` — notification outbox, claim/mark RPCs, and notification-aware response RPCs.
- `supabase/migrations/20261126100000_invitation_management.sql` — database-backed invitation code, admin audit events, atomic reset, and rate-limited verification RPC.

## Required environment variables

Set these in Vercel **Project Settings → Environment Variables**. Server variables must never use a `VITE_` prefix. The canonical list is in `.env.example` and `DEPLOYMENT.md`.

| Variable | Required | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Project URL from Supabase. |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | Current `sb_publishable_…` key. Non-secret; mirrored to `VITE_SUPABASE_PUBLISHABLE_KEY` only for the browser admin login. |
| `SUPABASE_SECRET_KEY` | Yes | Current `sb_secret_…` key. Server-only, bypasses RLS, and must never be exposed to the browser. |
| `INVITATION_CODE` | Bootstrap only | Temporary fallback while no database-backed code exists. Once an admin generates a code in the dashboard, the database is authoritative and this value is ignored. Never returned by the API. |
| `SESSION_SECRET` | Yes | Server-only HMAC pepper for invitation session hashes. Use at least 32 random characters. Rotating it invalidates existing sessions. |
| `APP_URL` | Yes | Exact deployed origin, e.g. `https://your-project.vercel.app`. Used for CSRF checks and to derive the dashboard link. |
| `ADMIN_NOTIFICATION_EMAIL` | Yes | Recipient address for admin notifications. Do not invent this address. |
| `RESEND_API_KEY` | Yes | Resend API key. Server-only. Never exposed to the browser. |
| `RESEND_FROM_EMAIL` | Yes | Verified Resend sender address. Do not invent this address. |
| `PROPOSAL_ID` | No | Defaults to `roqeebah-001`. Must match the proposal row identity. |
| `INVITATION_SESSION_TTL_SECONDS` | No | Defaults to `604800` (7 days). Allowed range: 60–2592000. |
| `RESEND_TIMEOUT_MS` | No | Defaults to `5000`. Allowed range: 1000–30000. |
| `ADMIN_DASHBOARD_URL` | No | Optional override. Derived from `APP_URL` as `<APP_URL>/admin/responses` when omitted. |
| `ALLOWED_ORIGINS` | No | Optional comma-separated alternative to `APP_URL` for local/multi-origin setups. |

The legacy `SUPABASE_SERVICE_ROLE_KEY` and `APP_ORIGIN` names still work as fallbacks for existing local setups, but new deployments should use `SUPABASE_SECRET_KEY` and `APP_URL`.

Email delivery failures never fail the response request. If notification configuration is missing or invalid, the response still succeeds and the failure is recorded in the outbox.

## Database setup

Run migrations in order in the Supabase SQL Editor:

1. `supabase/migrations/20261126000000_proposal_responses.sql`
2. `supabase/migrations/20261126010000_invitation_sessions.sql`
3. `supabase/migrations/20261126020000_response_notifications.sql`
4. `supabase/migrations/20261126030000_admin_auth.sql`
5. `supabase/migrations/20261126040000_admin_response_dashboard.sql`
6. `supabase/migrations/20261126100000_invitation_management.sql`

The second migration creates:

- `invitation_sessions` — stores only SHA-256 hashes of random session tokens.
- `invitation_rate_limits` — persistent fixed-window counters.
- `api_*` RPC functions granted only to `service_role`.

The third migration creates:

- `response_notifications` — durable outbox with one row per response history event.
- `api_claim_notifications`, `api_mark_notification_sent`, and `api_mark_notification_failed` RPCs, granted only to `service_role`.
- Notification-aware replacements for `api_submit_response` and `api_update_response`.

All response + history + outbox mutations happen inside those RPC functions so they are atomic.

The sixth migration creates:

- `invitation_settings` — one row storing only a SHA-256 hex digest of the active code, plus `enabled`, `created_at`, `updated_at`, and `revoked_at`.
- `admin_audit_events` — non-content metadata (event type, actor id, row counts, recipient domain). Never stores response values or response timestamps.
- `api_rotate_invitation_code`, `api_revoke_invitation_code`, `api_set_invitation_access`, `api_get_invitation_status`, `api_get_reset_preview`, `api_is_active_invitation_code`, `api_reset_proposal_data`, `api_verify_invitation_and_create_session`, and `api_log_admin_event`, all granted only to `service_role`.
- `assert_proposal_admin(uuid)`, which re-checks `app_metadata.role = 'admin'` inside every mutating RPC.

Rotation, revocation, and disabling revoke all existing invitation sessions in the same transaction. A plain reset leaves invitation settings untouched; code rotation during reset is opt-in.

## Endpoints

All paths are relative. The browser service uses `credentials: 'same-origin'` so the HTTP-only session cookie is sent automatically; it never reads or stores the cookie or invitation code.

### `POST /api/invitation/verify`

Verifies the invitation code and starts a secure session **before any response can be submitted**. It does not submit a response or send an email.

```json
{ "invitationCode": "the-invitation-code" }
```

Success: `200 OK`

```json
{ "status": "verified" }
```

Sets the same `__Host-roqeebah_session` cookie described below. Invalid codes return `401` with `invalid_invitation_code`; the same five-per-15-minute rate limit applies.

`POST /api/invitation` remains as a backward-compatible alias with identical behavior. New clients should use `/api/invitation/verify`.

### `POST /api/responses`

On first use, verifies the invitation code, creates a session, sets a cookie, and submits the first response. If a valid session cookie already exists, the invitation code is not needed.

```json
{
  "response": "yes",
  "invitationCode": "the-invitation-code"
}
```

Allowed responses: `yes`, `thinking`, `no`.

Success: `201 Created`

```json
{
  "response": "yes",
  "created_at": "2026-11-26T12:00:00.000Z",
  "updated_at": "2026-11-26T12:00:00.000Z"
}
```

Sets:

```text
Set-Cookie: __Host-roqeebah_session=<random-token>; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Strict
```

### `PATCH /api/responses`

Changes the existing answer for the active session.

```json
{ "response": "thinking" }
```

Success: `200 OK`. Repeating the same answer returns `200` with `unchanged` behavior and creates no extra history row or email.

### `GET /api/responses`

Returns only the current answer and timestamps for the active session.

Success:

```json
{
  "response": "thinking",
  "created_at": "2026-11-26T12:00:00.000Z",
  "updated_at": "2026-11-26T12:10:00.000Z"
}
```

## Admin endpoints

All admin paths require a valid Supabase access token in the `Authorization: Bearer <token>` header and `app_metadata.role = 'admin'`. The server verifies the token with Supabase Auth on every request; frontend role checks are only for UX. All mutations also require a same-origin `Origin` header. The stored code hash is never included in any response.

### `GET /api/admin/invitation`

Returns `{ enabled, initialized, status, created_at, updated_at, revoked_at }` where `status` is `active`, `disabled`, or `not_initialized`.

### `POST /api/admin/invitation`

```json
{ "action": "generate" }
```

Other actions: `{ "action": "revoke" }` and `{ "action": "set_access", "enabled": true|false }`.

`generate` creates a `ROQ-` code with 192 bits of randomness, stores only its SHA-256 hash, activates access, revokes all existing sessions, and returns the plaintext code **once**. `revoke` clears the code and revokes all sessions. `set_access` enables or disables access; disabling also revokes sessions, and enabling requires a code to exist.

### `POST /api/admin/invitation/preview`

```json
{ "email": "recipient@example.com" }
```

Generates a new code (same rotation and session invalidation as above) and returns `{ status: "preview", code, to, subject, websiteUrl, body }`. It never sends email. The preview body is the exact plain-text email that will be delivered.

### `POST /api/admin/invitation/send`

```json
{ "email": "recipient@example.com", "code": "ROQ-…" }
```

Re-checks that the code is still active, then sends the website URL and code through the server-only Resend integration. Sending is limited to 10 requests per 15 minutes per admin. Success returns `{ "status": "sent" }`. A stale code returns `400 code_not_active`. Audit logging stores only the recipient domain and event type.

### `GET /api/admin/reset`

Returns `{ "counts": { responses, history, notifications, sessions, rate_limits } }` so the dashboard can show exactly what a reset would delete. No row content is returned.

### `POST /api/admin/reset`

```json
{ "confirmation": "RESET", "rotateCode": false }
```

`confirmation` must be exactly `RESET`. `rotateCode` defaults to false; when true, a new code is generated and returned once in `{ "code": "ROQ-…" }`. The database RPC deletes the scoped response, history, notification, invitation session, and rate-limit rows in one transaction and writes a content-free `proposal_reset` audit event with only row counts. Admin accounts, auth, schema, website content, Supabase config, and invitation settings are preserved.

## Email notifications

Notifications are sent only from the server after a successful `created` or `updated` response. No email is sent for `unchanged`, `conflict`, `unauthorized`, `rate_limited`, or invalid requests.

| Event | Subject |
| --- | --- |
| Initial response | `A new response has arrived ❤️` |
| Response change | `Roqeebah updated her response ❤️` |

The HTML/text body includes:

- Proposal name: `A Letter to Roqeebah`.
- Latest response.
- Previous response for changes (initial submissions say it is not applicable).
- Response timestamp.
- Link to `<APP_URL>/admin/responses` (or the optional `ADMIN_DASHBOARD_URL` override).

The design uses the site's burgundy (`#873F50`) and cream (`#FFFCF8` / `#F9F1EC`) palette and a responsive table layout. No invitation code, session token, or unnecessary personal information is included.

### Delivery and retry model

- The response RPC inserts one outbox row with the response and history writes in the same transaction.
- A unique `history_id` and stable `idempotency_key` mean repeated requests cannot create duplicate notifications.
- After the response succeeds, the API claims pending rows and POSTs to `https://api.resend.com/emails` with the `Idempotency-Key` header.
- Provider success marks the row `sent` with the Resend message id.
- Provider failure, timeout, or missing configuration marks the row `failed` with a safe error message and schedules a retry; after 5 attempts the row remains failed with no next attempt time.
- Failures are logged by variable name/error message only — never with API keys, tokens, or codes.
- Email delivery never blocks or fails the response request.

A future cron job can call `api_claim_notifications` and the send flow to retry failed rows. The admin dashboard now displays delivery status; the new invitation email feature uses a separate, explicit send endpoint.

## Security behavior

- Invitation codes are compared as SHA-256 hashes using constant-time comparison. Only the hash is stored; plaintext is returned once to the admin who generated it.
- The expected code is never returned to public clients and never stored in the browser.
- Admin mutations verify the Supabase JWT server-side, require an allowed `Origin`, and re-check the admin claim inside the database RPC.
- Rotation, revocation, and disabling revoke all invitation sessions immediately.
- Session tokens are random 32-byte values; only their SHA-256 hashes are persisted.
- Cookies are `__Host-` prefixed, `HttpOnly`, `Secure`, and `SameSite=Strict`.
- `POST` and `PATCH` require a matching `Origin` header.
- `proposal_id` is taken from the server-side session, never from request input.
- Response ownership cannot be supplied by the browser.
- `RESEND_API_KEY`, `SUPABASE_SECRET_KEY`, `SESSION_SECRET`, invitation codes, and session tokens are never returned by any endpoint or email.
- Rate limits:
  - Invitation code attempts: 5 per 15 minutes per client IP hash (single rate-limit check inside the verification RPC).
  - Response reads: 60 per 5 minutes per client IP hash.
  - Response writes: 10 per 5 minutes per client IP hash.
   - Admin invitation sends: 10 per 15 minutes per admin id.

## Status codes

| Status | Meaning |
| --- | --- |
| 200 | Invitation verified, retrieval succeeded, or update succeeded. |
| 201 | Initial response created. |
| 400 | Invalid JSON, invalid response value, missing code, or invalid request. |
| 401 | Missing/invalid/expired invitation session or invalid invitation code. |
| 403 | Missing or disallowed request origin. |
| 404 | No response has been submitted yet. |
| 405 | Unsupported method. |
| 409 | Initial response already exists, or update attempted before first submission. |
| 429 | Rate limit exceeded. |
| 500 | Internal server error. Details are logged server-side only. |

## Frontend flow

1. The browser calls `GET /api/responses` on load. A valid session with a saved answer goes to a “your answer is saved” view; `404` means the session is valid but no answer exists; `401` means the visitor must verify the invitation.
2. `InvitationCode.tsx` posts the code to `/api/invitation/verify`. The code is cleared from React state immediately and is never written to `localStorage` or `sessionStorage`.
3. The proposal buttons call `POST /api/responses`. The UI disables all buttons while the request is in flight and navigates only after a successful response.
4. Returning visitors can choose **Change my answer**, which calls `PATCH /api/responses`, then refreshes the saved answer and shows an update confirmation.

## Local development

Relative `/api` paths work on Vercel without configuration. Locally, Vite proxies `/api` to `http://127.0.0.1:3000` by default, so run `vercel dev` on port 3000 alongside `npm run dev`. Set `API_PROXY_TARGET` if your API dev server uses a different origin. Keep `APP_URL` set to the browser origin (for example `http://localhost:5173`) so the CSRF origin check accepts the proxied request.
