# Private response dashboard

Route: `/admin/responses`

The dashboard is a client-side React view protected by the Step 4 Supabase Auth guard. It reads directly from Supabase with the browser publishable key; every read is enforced by Row Level Security. There is no public dashboard endpoint and no service-role key in the browser.

## What it shows

- **Header** — "A Letter to Roqeebah", subtitle "Private Response Dashboard", Refresh, and Log out.
- **Summary cards** — current response, initial submission date, last response update, and total answer changes.
- **Current response** — `YES ❤️`, `NEEDS TIME 💗`, or `NO`, plus exact created/updated timestamps. With no response it shows "Waiting for a response." and "Your little surprise is waiting for its answer."
- **Response history** — a chronological timeline built from `public.proposal_response_history` with previous answer, new answer, and date/time.
- **Notification status** — counts of delivered, failed, and pending/in-progress emails from `public.response_notifications`. No API keys, idempotency keys, errors, or environment variables are displayed.
- **Invitation management** — status badge, last-updated and created/revoked timestamps, generate/replace code, copy code, enable/disable access, and revoke with inline confirmation. The plaintext code is shown once and can be cleared from the screen. Rotation, revocation, and disabling revoke all existing invitation sessions immediately.
- **Send invitation** — recipient email, "Generate code & preview" (never sends), exact email preview with website URL and code, then an explicit "I confirm this email" + "Confirm and send" step. Sending uses the server-only Resend integration.
- **Reset proposal** — a destructive section showing exact row counts, a required `RESET` confirmation, and an optional "also rotate the code" checkbox that is off by default. It clears the current response, history, notification rows, invitation sessions, and scoped rate-limit counters through an atomic RPC, then refreshes the dashboard.

All three management sections call server endpoints with the admin's Supabase access token. Loading, success, and error states are shown inline. Only SHA-256 hashes are stored server-side; no hash, code, API key, or bearer token is rendered after generation.

Manual refresh is implemented. Supabase Realtime is intentionally not used to avoid unnecessary complexity.

## Environment

Browser-safe variables (from `.env.example`):

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_PROPOSAL_ID=roqeebah-001
```

`VITE_PROPOSAL_ID` is an identifier, not a secret, and must match the API's `PROPOSAL_ID`. Never expose `SUPABASE_SECRET_KEY`, `SESSION_SECRET`, `RESEND_API_KEY`, `INVITATION_CODE`, or bearer tokens to the browser. `INVITATION_CODE` is now only a bootstrap fallback; after an admin generates a code in the dashboard, the database-backed code is the only one accepted.

## Database requirements

Run all six migrations in order (see `DEPLOYMENT.md`). For the dashboard specifically:

- `proposal_responses` and `proposal_response_history` have admin-only SELECT policies based on `app_metadata.role = 'admin'`.
- `20261126040000_admin_response_dashboard.sql` grants admins SELECT on `response_notifications` with an RLS policy using `public.is_proposal_admin()`.
- `20261126100000_invitation_management.sql` adds `invitation_settings`, `admin_audit_events`, and service-role-only RPCs that re-check the admin claim before managing invitations or resetting data.
- `anon` has no grants or policies on these tables; non-admin authenticated users match no policy.
- Public writes still go only through the service-role Vercel API at `/api/responses`.

Frontend role checks are only for UX. RLS is the authority for data access.

## Verification checklist

1. Sign in with the designated admin at `/admin/login` — dashboard loads.
2. Visit `/admin/responses` without a session — redirected to `/admin/login`.
3. Sign in with a non-admin account — access is rejected.
4. With a response present, confirm the current answer and exact timestamps.
5. After an answer change, confirm a new timeline entry appears.
6. Confirm delivered/failed/pending counts reflect outbox rows.
7. With no response row, confirm the empty-state message.
8. Use Refresh after external data changes; use Log out to end the session.
9. In Invitation management, generate a code, copy it, then confirm an old code no longer verifies and the previous session is invalidated.
10. Disable access and confirm verification is blocked; re-enable and confirm it works again.
11. Revoke the code and confirm the status shows "Not initialized" with a revoked timestamp.
12. In Send invitation, enter an email, generate a preview, confirm nothing was sent yet, then explicitly confirm and send; verify delivery.
13. In Reset proposal, confirm the listed counts match, type `RESET`, leave rotation unchecked, and confirm response data is cleared while the invitation code remains unchanged.
14. Repeat a reset with "also rotate the code" checked and confirm a new code is shown once and old sessions stop working.
15. Confirm no hash, code, API key, or bearer token appears in the DOM or network responses after these flows.

To produce that empty state on the live project before the first real visitor, either use the **Reset proposal** section above or the [clean reset runbook](reset.md). Both remove test responses, history, sessions, rate limits, and notification rows without touching schema or authentication. The dashboard reset records a content-free audit event and never rotates the invitation code unless explicitly selected.
