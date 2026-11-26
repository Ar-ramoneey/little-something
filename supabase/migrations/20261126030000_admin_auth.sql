-- Step 4: trusted admin authorization and least-privilege browser grants.
-- Target: Supabase PostgreSQL (Postgres 15+).
-- Run after 20261126020000_response_notifications.sql.
--
-- Admin identity comes only from the signed JWT app_metadata claim.
-- user_metadata is editable by the user and is never consulted.

create or replace function public.is_proposal_admin()
returns boolean
language sql
stable
parallel safe
set search_path = ''
as $$
  select auth.uid() is not null
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

comment on function public.is_proposal_admin() is
  'True only for authenticated users whose trusted app_metadata.role is admin.';

-- anon never needs to evaluate admin policies; it has no table grants either.
revoke all on function public.is_proposal_admin() from public, anon;
grant execute on function public.is_proposal_admin() to authenticated, service_role;

alter table public.proposal_responses enable row level security;
alter table public.proposal_response_history enable row level security;

-- Defense in depth: browsers may never insert response rows or write history.
-- Public submissions go exclusively through the service_role Vercel API.
revoke insert on public.proposal_responses from authenticated;
grant select, update on public.proposal_responses to authenticated;
grant select on public.proposal_response_history to authenticated;

-- Recreate policies idempotently so this migration is self-contained.
drop policy if exists "Admins can read proposal responses" on public.proposal_responses;
create policy "Admins can read proposal responses"
  on public.proposal_responses
  for select
  to authenticated
  using (public.is_proposal_admin());

drop policy if exists "Admins can update proposal responses" on public.proposal_responses;
create policy "Admins can update proposal responses"
  on public.proposal_responses
  for update
  to authenticated
  using (public.is_proposal_admin())
  with check (public.is_proposal_admin());

drop policy if exists "Admins can read proposal response history" on public.proposal_response_history;
create policy "Admins can read proposal response history"
  on public.proposal_response_history
  for select
  to authenticated
  using (public.is_proposal_admin());

-- No anonymous policies exist. Auth users without @role=admin match no policy.
