# Private admin authentication

The admin area is a separate, protected part of the Vite app:

- `/admin/login` — email/password sign-in. There is no public registration screen or endpoint.
- `/admin` (and any `/admin/*` path) — protected dashboard shell. Unauthenticated or non-admin users are redirected to `/admin/login`.
- **Log out** is available on the dashboard and on the "not authorized" screen.

Dashboard statistics and response tables are intentionally not implemented yet.

## How authorization works

- Supabase Auth handles email/password sessions in the browser.
- The browser uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Those values mirror the server-side `SUPABASE_URL` and non-secret `SUPABASE_PUBLISHABLE_KEY`.
- The Supabase secret key (`sb_secret_…`) is **server-only** and is never given a `VITE_` prefix.
- Admin privileges come only from the trusted signed JWT `app_metadata.role = admin` claim.
- `user_metadata` is editable by the user and is never consulted.
- Row Level Security is the final authority: RLS policies call `public.is_proposal_admin()`, which checks `auth.uid()` and `app_metadata.role`.

## Environment variables

Add these to `.env` locally (copy `.env.example` first) and to Vercel **Project Settings → Environment Variables**:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_PROPOSAL_ID=roqeebah-001
```

`VITE_PROPOSAL_ID` is a non-secret identifier and defaults to `roqeebah-001`. Keep it in sync with the server-side `PROPOSAL_ID`.

Never add `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `SESSION_SECRET`, or `INVITATION_CODE` as `VITE_` variables.

## Database setup

Run all migrations in order in the Supabase SQL Editor:

1. `supabase/migrations/20261126000000_proposal_responses.sql`
2. `supabase/migrations/20261126010000_invitation_sessions.sql`
3. `supabase/migrations/20261126020000_response_notifications.sql`
4. `supabase/migrations/20261126030000_admin_auth.sql`
5. `supabase/migrations/20261126040000_admin_response_dashboard.sql`

The fourth migration:

- Recreates the admin-only SELECT policies using `app_metadata.role`.
- Revokes direct `INSERT` on `proposal_responses` from `authenticated`, so browser clients can never create response rows.
- Revokes `is_proposal_admin()` from `anon`.
- Leaves all public response submissions going through the service-role Vercel API at `/api/responses`.

The fifth migration grants admins a read-only, RLS-protected view of the notification outbox for the private dashboard. See `docs/admin-dashboard.md`.

## Create the initial admin account manually

1. In Supabase, go to **Authentication → Users → Add user**.
2. Choose email/password and enter the designated administrator's email and a strong password.
3. Confirm the email address if email confirmation is enabled.
4. Do not add any public sign-up form or endpoint. This account is the only way into the admin area.

No administrator credentials are stored in this repository.

## Assign the trusted admin role

Go to **SQL Editor** and run the following, replacing the placeholder with the real admin email:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com');
```

Remove the claim from any other account:

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data - 'role'
where lower(email) <> lower('YOUR_ADMIN_EMAIL@example.com');
```

Do **not** put the role in `raw_user_meta_data`; that is user-editable and is ignored by the RLS policies.

The administrator must sign in again (or refresh their session) after this change so the JWT contains the new `app_metadata` claim.

## Verify access

### Admin account

1. Open `/admin/login` on the deployed site (or `http://localhost:5173/admin/login` locally).
2. Sign in with the designated account.
3. Confirm you land on the protected `/admin` dashboard and that **Log out** signs you out.

### Other accounts

1. Sign in at `/admin/login` with a different account that has no admin role.
2. Confirm the app shows "This account is not authorized" instead of the dashboard.
3. Confirm a direct visit to `/admin` also redirects away from the dashboard.

### RLS verification in SQL Editor

Replace the UUIDs with real values from `auth.users`:

```sql
-- Admin JWT: should return rows.
set role authenticated;
set request.jwt.claims = '{"sub":"ADMIN_USER_UUID","app_metadata":{"role":"admin"}}';
select count(*) from public.proposal_responses;
select count(*) from public.proposal_response_history;

-- Non-admin JWT: should return 0 rows for both queries.
set request.jwt.claims = '{"sub":"OTHER_USER_UUID","app_metadata":{}}';
select count(*) from public.proposal_responses;
select count(*) from public.proposal_response_history;

-- Anonymous: should be denied by privileges.
set role anon;
select count(*) from public.proposal_responses;
```

Reset with `reset role;` when finished.

## Security notes

- `public.is_proposal_admin()` is granted to `authenticated` and `service_role`, not `anon`.
- No `anon` RLS policies exist on response or history tables.
- Browser clients have no direct INSERT privilege on responses; writes happen through server RPCs only.
- The private dashboard link used in emails is derived from `APP_URL` as `<APP_URL>/admin/responses`.
