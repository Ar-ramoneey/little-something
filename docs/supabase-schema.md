# Supabase schema — proposal responses

This document describes the database foundation for **A Letter to Roqeebah**: response storage, audit history, invitation sessions/rate limits, and the notification outbox. See `docs/api.md` for the server API and Resend configuration, and `docs/admin-dashboard.md` for the private dashboard that reads these tables.

## Response values

The database stores one canonical value per response:

| UI choice | Stored value |
| --- | --- |
| Yes, I'd love to! | `yes` |
| I'd like to think about it. | `thinking` |
| No, thank you. | `no` |

The Vercel API translates the UI choice to these values before writing.

## Tables

### `public.proposal_responses`

One current row per proposal.

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `uuid` | Primary key, generated with `gen_random_uuid()` |
| `proposal_id` | `text` | Required, unique |
| `response` | `text` | Required; `yes`, `thinking`, or `no` |
| `created_at` | `timestamptz` | Defaults to `now()` |
| `updated_at` | `timestamptz` | Defaults to `now()`; updated by trigger |

The unique constraint on `proposal_id` guarantees only one current response exists for the proposal.

### `public.proposal_response_history`

Append-only audit trail of response values.

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `uuid` | Primary key, generated with `gen_random_uuid()` |
| `response_id` | `uuid` | Required FK to `proposal_responses.id`, `ON DELETE CASCADE` |
| `previous_response` | `text` | Nullable; `yes`, `thinking`, or `no` when present |
| `new_response` | `text` | Required; `yes`, `thinking`, or `no` |
| `changed_at` | `timestamptz` | Defaults to `now()` |

Indexes are created on `response_id` and `changed_at DESC` for admin lookups.

### `public.response_notifications`

Durable outbox for admin email notifications (added by `20261126020000_response_notifications.sql`).

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `uuid` | Primary key, generated with `gen_random_uuid()` |
| `history_id` | `uuid` | Required unique FK to `proposal_response_history.id`, `ON DELETE CASCADE` |
| `response_id` | `uuid` | Required FK to `proposal_responses.id`, `ON DELETE CASCADE` |
| `proposal_id` | `text` | Required |
| `event_type` | `text` | `initial` or `changed` |
| `previous_response` | `text` | Nullable; `yes`, `thinking`, or `no` when present |
| `new_response` | `text` | Required; `yes`, `thinking`, or `no` |
| `occurred_at` | `timestamptz` | Defaults to `now()` |
| `status` | `text` | `pending`, `processing`, `sent`, or `failed` |
| `attempts` | `integer` | Defaults to `0`; maximum 5 |
| `idempotency_key` | `text` | Required, unique, stable per history event |
| `provider_message_id`, `last_error`, `next_attempt_at`, `locked_until`, `sent_at` | various | Delivery tracking |

The unique `history_id` and `idempotency_key` prevent duplicate emails from repeated requests. RLS is enabled with no `anon`/`authenticated` access; only `service_role` may read or write rows or execute the `api_claim_notifications` / `api_mark_notification_*` RPCs.

## Triggers

- `proposal_responses_set_updated_at` — a `BEFORE UPDATE` trigger that refreshes `updated_at`.
- `proposal_responses_record_change` — an `AFTER INSERT OR UPDATE` trigger that writes history:
  - Initial insert: `previous_response = NULL`, `new_response = <initial response>`.
  - Response change: `previous_response = <old value>`, `new_response = <new value>`.
  - An update that does not change `response` does **not** create a history row.

The history trigger is `SECURITY DEFINER` so it can write history even when an authorized admin updates the current response through RLS. There is no direct `INSERT` policy on the history table.

## RLS and access model

RLS is enabled on both tables.

| Role | Current response | History |
| --- | --- | --- |
| `anon` | No access | No access |
| `authenticated` (non-admin) | No access | No access |
| `authenticated` (admin claim) | `SELECT`, `UPDATE` | `SELECT` |
| `service_role` | Full server-side access | Full server-side access |

Rules:

- No policies are granted to `anon`.
- No public/anonymous reads or writes are allowed.
- Admin access requires a valid Supabase Auth JWT and `app_metadata.role = 'admin'`.
- The public website must not connect directly to Supabase for response data. Future Vercel Functions will use `service_role` server-side.
- Never put the Supabase `service_role` key, database password, or any secret in frontend code or `VITE_` environment variables.

## Configure the authorized admin user

Before relying on admin access, set the `admin` role claim on the intended Supabase Auth user only.

### Option A — Supabase Dashboard

1. Go to **Authentication → Users**.
2. Select the authorized admin user.
3. In the user's metadata, set **App metadata** to:

   ```json
   { "role": "admin" }
   ```

4. Do not set this claim on any other user.

### Option B — SQL Editor

Replace the email address, then run:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com');
```

Optional cleanup if another user already has the claim:

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data - 'role'
where lower(email) <> lower('YOUR_ADMIN_EMAIL@example.com');
```

Users must sign in again (or refresh their session) after their app metadata changes so their JWT contains the new claim.

## Execute the migration in Supabase SQL Editor

1. Open the Supabase project for this site.
2. Go to **SQL Editor**.
3. Click **New query**.
4. Paste and run the full contents of these files, in order:

   ```text
   supabase/migrations/20261126000000_proposal_responses.sql
   supabase/migrations/20261126010000_invitation_sessions.sql
   supabase/migrations/20261126020000_response_notifications.sql
   ```

5. Confirm the tables appear under **Table Editor → public**, including `response_notifications`.
6. Configure the admin user as described above.

The migrations are safe to re-run: they use `create table if not exists`, `create or replace function`, and drop/recreate their policies and triggers by name.

## Verification queries

Confirm RLS is enabled:

```sql
select relname, relrowsecurity
from pg_class
where relname in ('proposal_responses', 'proposal_response_history')
order by relname;
```

Confirm policies exist only for `authenticated`:

```sql
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('proposal_responses', 'proposal_response_history')
order by tablename, policyname;
```

Confirm there are no anonymous policies:

```sql
select count(*) as anon_policy_count
from pg_policies
where schemaname = 'public'
  and tablename in ('proposal_responses', 'proposal_response_history')
  and 'anon' = any(roles);
```

Expected: `anon_policy_count = 0`.

> `select public.is_proposal_admin();` in the SQL Editor will return `false` because the editor does not send an authenticated user JWT. That is expected.

## Next step

The secure Vercel Function at `/api/responses` is implemented. The remaining work is frontend wiring and the private admin dashboard; both are out of scope for the current step.
