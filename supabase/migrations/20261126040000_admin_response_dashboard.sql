-- Step 5: allow the private admin dashboard to read notification status.
-- Target: Supabase PostgreSQL (Postgres 15+).
-- Run after 20261126030000_admin_auth.sql.
--
-- Response and history admin reads already exist from earlier migrations.
-- This migration adds a read-only, RLS-protected view of the Resend outbox so
-- the dashboard can show delivered/failed/pending counts without any secret.

alter table public.response_notifications enable row level security;

revoke all on table public.response_notifications from public, anon;
grant select on public.response_notifications to authenticated;

drop policy if exists "Admins can read notification status" on public.response_notifications;
create policy "Admins can read notification status"
  on public.response_notifications
  for select
  to authenticated
  using (public.is_proposal_admin());

-- No public/anon policies are created. Non-admin authenticated users match no
-- policy and therefore see no outbox rows. The API continues to use service_role.
