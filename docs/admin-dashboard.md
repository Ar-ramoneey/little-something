# Private response dashboard

Route: `/admin/responses`

The dashboard is a client-side React view protected by the Step 4 Supabase Auth guard. It reads directly from Supabase with the browser publishable key; every read is enforced by Row Level Security. There is no public dashboard endpoint and no service-role key in the browser.

## What it shows

- **Header** — "A Letter to Roqeebah", subtitle "Private Response Dashboard", Refresh, and Log out.
- **Summary cards** — current response, initial submission date, last response update, and total answer changes.
- **Current response** — `YES ❤️`, `NEEDS TIME 💗`, or `NO`, plus exact created/updated timestamps. With no response it shows "Waiting for a response." and "Your little surprise is waiting for its answer."
- **Response history** — a chronological timeline built from `public.proposal_response_history` with previous answer, new answer, and date/time.
- **Notification status** — counts of delivered, failed, and pending/in-progress emails from `public.response_notifications`. No API keys, idempotency keys, errors, or environment variables are displayed.

Manual refresh is implemented. Supabase Realtime is intentionally not used to avoid unnecessary complexity.

## Environment

Browser-safe variables (from `.env.example`):

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_PROPOSAL_ID=roqeebah-001
```

`VITE_PROPOSAL_ID` is an identifier, not a secret, and must match the API's `PROPOSAL_ID`. Never expose `SUPABASE_SECRET_KEY`, `SESSION_SECRET`, `RESEND_API_KEY`, `INVITATION_CODE`, or bearer tokens to the browser.

## Database requirements

Run all five migrations in order (see `docs/admin-auth.md`). For the dashboard specifically:

- `proposal_responses` and `proposal_response_history` have admin-only SELECT policies based on `app_metadata.role = 'admin'`.
- `20261126040000_admin_response_dashboard.sql` grants admins SELECT on `response_notifications` with an RLS policy using `public.is_proposal_admin()`.
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
