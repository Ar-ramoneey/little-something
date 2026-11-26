-- Step 1: Supabase database foundation for proposal response tracking.
-- Target: Supabase PostgreSQL (Postgres 15+).
-- Run once in the Supabase SQL Editor.
--
-- UI value mapping for the future API layer:
--   accepted -> 'yes'
--   thinking -> 'thinking'
--   declined -> 'no'

create table if not exists public.proposal_responses (
  id uuid primary key default gen_random_uuid(),
  proposal_id text not null unique,
  response text not null check (response in ('yes', 'thinking', 'no')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proposal_response_history (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null
    references public.proposal_responses (id) on delete cascade,
  previous_response text check (previous_response in ('yes', 'thinking', 'no')),
  new_response text not null check (new_response in ('yes', 'thinking', 'no')),
  changed_at timestamptz not null default now()
);

create index if not exists proposal_response_history_response_id_idx
  on public.proposal_response_history (response_id);

create index if not exists proposal_response_history_changed_at_idx
  on public.proposal_response_history (changed_at desc);

comment on table public.proposal_responses is
  'Current response for a proposal. One row per proposal_id.';

comment on column public.proposal_responses.response is
  'Allowed values: yes, thinking, no.';

comment on table public.proposal_response_history is
  'Append-only record of every response value, including the initial response.';

-- Keep updated_at accurate without relying on the client.
create or replace function public.set_proposal_response_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Admin identity comes from a signed Supabase Auth JWT claim.
-- Only users whose app_metadata contains {"role": "admin"} can pass this check.
-- See docs/supabase-schema.md for the one-time admin setup step.
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

-- Security definer: an admin's UPDATE can still write history even though
-- no direct INSERT policy is granted on proposal_response_history.
create or replace function public.record_proposal_response_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.proposal_response_history
      (response_id, previous_response, new_response, changed_at)
    values
      (new.id, null, new.response, new.created_at);
    return new;
  end if;

  if tg_op = 'UPDATE' and new.response is distinct from old.response then
    insert into public.proposal_response_history
      (response_id, previous_response, new_response, changed_at)
    values
      (new.id, old.response, new.response, now());
  end if;

  return new;
end;
$$;

drop trigger if exists proposal_responses_set_updated_at on public.proposal_responses;
create trigger proposal_responses_set_updated_at
  before update on public.proposal_responses
  for each row execute function public.set_proposal_response_updated_at();

drop trigger if exists proposal_responses_record_change on public.proposal_responses;
create trigger proposal_responses_record_change
  after insert or update on public.proposal_responses
  for each row execute function public.record_proposal_response_change();

-- Row Level Security. No anon policies are created anywhere in this migration.
alter table public.proposal_responses enable row level security;
alter table public.proposal_response_history enable row level security;

-- Remove broad/default public access, then grant least-privilege access.
revoke all on table public.proposal_responses from public, anon;
revoke all on table public.proposal_response_history from public, anon;

grant select, insert, update on public.proposal_responses to authenticated;
grant select on public.proposal_response_history to authenticated;

-- service_role is for server-side Vercel Functions only and bypasses RLS.
-- Never expose this role's key in frontend code or VITE_ environment variables.
grant all on table public.proposal_responses to service_role;
grant all on table public.proposal_response_history to service_role;

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

-- Function privileges.
revoke all on function public.is_proposal_admin() from public;
grant execute on function public.is_proposal_admin() to anon, authenticated, service_role;

revoke all on function public.set_proposal_response_updated_at() from public;
grant execute on function public.set_proposal_response_updated_at() to authenticated, service_role;

revoke all on function public.record_proposal_response_change() from public;
grant execute on function public.record_proposal_response_change() to authenticated, service_role;
