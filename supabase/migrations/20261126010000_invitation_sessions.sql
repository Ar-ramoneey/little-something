-- Step 2: secure invitation sessions and atomic response API functions.
-- Target: Supabase PostgreSQL (Postgres 15+).
-- Run after 20261126000000_proposal_responses.sql.
--
-- All API database work goes through SECURITY DEFINER functions granted only
-- to service_role. These functions keep response + history writes atomic and
-- never accept proposal_id or response ownership from the browser.

create table if not exists public.invitation_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique
    constraint invitation_sessions_token_hash_format check (token_hash ~ '^[0-9a-f]{64}$'),
  proposal_id text not null
    constraint invitation_sessions_proposal_id_not_empty check (length(proposal_id) > 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
    constraint invitation_sessions_expires_after_created check (expires_at > created_at),
  revoked_at timestamptz,
  last_used_at timestamptz
);

create index if not exists invitation_sessions_proposal_id_idx
  on public.invitation_sessions (proposal_id);

create index if not exists invitation_sessions_expires_at_idx
  on public.invitation_sessions (expires_at);

create table if not exists public.invitation_rate_limits (
  key text primary key
    constraint invitation_rate_limits_key_not_empty check (length(key) > 0),
  attempt_count integer not null default 0
    constraint invitation_rate_limits_attempt_count_nonnegative check (attempt_count >= 0),
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.invitation_sessions is
  'Server-issued invitation sessions. Only SHA-256 token hashes are stored.';

comment on table public.invitation_rate_limits is
  'Persistent request counters for invitation-code and response endpoints.';

-- Row Level Security: no browser role can read or write these tables directly.
alter table public.invitation_sessions enable row level security;
alter table public.invitation_rate_limits enable row level security;

revoke all on table public.invitation_sessions from public, anon, authenticated;
revoke all on table public.invitation_rate_limits from public, anon, authenticated;

grant all on table public.invitation_sessions to service_role;
grant all on table public.invitation_rate_limits to service_role;

-- Generic fixed-window limiter. Returns false when the limit is exceeded.
create or replace function public.api_check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_row public.invitation_rate_limits%rowtype;
begin
  if p_key is null or length(p_key) = 0 or length(p_key) > 256
     or p_limit is null or p_limit < 1
     or p_window_seconds is null or p_window_seconds < 1 then
    return false;
  end if;

  select *
    into v_row
    from public.invitation_rate_limits
   where key = p_key
   for update;

  if not found then
    insert into public.invitation_rate_limits
      (key, attempt_count, window_started_at, updated_at)
    values
      (p_key, 1, v_now, v_now);
    return true;
  end if;

  if v_now >= v_row.window_started_at + make_interval(secs => p_window_seconds) then
    update public.invitation_rate_limits
       set attempt_count = 1,
           window_started_at = v_now,
           blocked_until = null,
           updated_at = v_now
     where key = p_key;
    return true;
  end if;

  if v_row.attempt_count >= p_limit then
    update public.invitation_rate_limits
       set blocked_until = v_now,
           updated_at = v_now
     where key = p_key;
    return false;
  end if;

  update public.invitation_rate_limits
     set attempt_count = v_row.attempt_count + 1,
         updated_at = v_now
   where key = p_key;
  return true;
end;
$$;

create or replace function public.api_reset_rate_limit(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.invitation_rate_limits where key = p_key;
end;
$$;

-- Creates a new session after the server has verified the invitation code.
-- Existing sessions for the same proposal are revoked.
create or replace function public.api_create_invitation_session(
  p_token_hash text,
  p_proposal_id text,
  p_expires_at timestamptz,
  p_rate_limit_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed boolean;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
     or p_proposal_id is null or length(p_proposal_id) = 0
     or p_expires_at is null or p_expires_at <= now() then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  v_allowed := public.api_check_rate_limit(p_rate_limit_key, 5, 900);
  if not v_allowed then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  update public.invitation_sessions
     set revoked_at = now()
   where proposal_id = p_proposal_id
     and revoked_at is null;

  insert into public.invitation_sessions
    (token_hash, proposal_id, expires_at)
  values
    (p_token_hash, p_proposal_id, p_expires_at);

  perform public.api_reset_rate_limit(p_rate_limit_key);

  return jsonb_build_object(
    'status', 'created',
    'expires_at', p_expires_at
  );
exception when unique_violation then
  return jsonb_build_object('status', 'invalid_request');
end;
$$;

-- Validates and touches a session. Returns no rows when invalid/expired/revoked.
create or replace function public.api_use_invitation_session(p_token_hash text)
returns table (session_id uuid, proposal_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_session_id uuid;
  v_proposal_id text;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  update public.invitation_sessions
     set last_used_at = v_now
   where token_hash = p_token_hash
     and revoked_at is null
     and expires_at > v_now
  returning public.invitation_sessions.id, public.invitation_sessions.proposal_id
    into v_session_id, v_proposal_id;

  if v_session_id is null then
    return;
  end if;

  return query select v_session_id, v_proposal_id;
end;
$$;

create or replace function public.api_get_response(
  p_token_hash text,
  p_rate_limit_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_allowed boolean;
  v_response text;
  v_created_at timestamptz;
  v_updated_at timestamptz;
begin
  v_allowed := public.api_check_rate_limit(p_rate_limit_key, 60, 300);
  if not v_allowed then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  select * into v_session
    from public.api_use_invitation_session(p_token_hash)
   limit 1;

  if not found then
    return jsonb_build_object('status', 'unauthorized');
  end if;

  select response, created_at, updated_at
    into v_response, v_created_at, v_updated_at
    from public.proposal_responses
   where proposal_id = v_session.proposal_id;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'response', v_response,
    'created_at', v_created_at,
    'updated_at', v_updated_at
  );
end;
$$;

-- Initial submission. The existing AFTER INSERT trigger writes history atomically.
create or replace function public.api_submit_response(
  p_token_hash text,
  p_response text,
  p_rate_limit_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_allowed boolean;
  v_created_at timestamptz;
  v_updated_at timestamptz;
begin
  v_allowed := public.api_check_rate_limit(p_rate_limit_key, 10, 300);
  if not v_allowed then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  if p_response is null or p_response not in ('yes', 'thinking', 'no') then
    return jsonb_build_object('status', 'invalid_response');
  end if;

  select * into v_session
    from public.api_use_invitation_session(p_token_hash)
   limit 1;

  if not found then
    return jsonb_build_object('status', 'unauthorized');
  end if;

  begin
    insert into public.proposal_responses
      (proposal_id, response)
    values
      (v_session.proposal_id, p_response)
    returning created_at, updated_at into v_created_at, v_updated_at;
  exception when unique_violation then
    return jsonb_build_object('status', 'conflict');
  end;

  return jsonb_build_object(
    'status', 'created',
    'response', p_response,
    'created_at', v_created_at,
    'updated_at', v_updated_at
  );
end;
$$;

-- Answer change. Repeated identical requests are no-ops and create no history.
create or replace function public.api_update_response(
  p_token_hash text,
  p_response text,
  p_rate_limit_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_allowed boolean;
  v_current_response text;
  v_created_at timestamptz;
  v_updated_at timestamptz;
begin
  v_allowed := public.api_check_rate_limit(p_rate_limit_key, 10, 300);
  if not v_allowed then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  if p_response is null or p_response not in ('yes', 'thinking', 'no') then
    return jsonb_build_object('status', 'invalid_response');
  end if;

  select * into v_session
    from public.api_use_invitation_session(p_token_hash)
   limit 1;

  if not found then
    return jsonb_build_object('status', 'unauthorized');
  end if;

  select response, created_at, updated_at
    into v_current_response, v_created_at, v_updated_at
    from public.proposal_responses
   where proposal_id = v_session.proposal_id
   for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_current_response = p_response then
    return jsonb_build_object(
      'status', 'unchanged',
      'response', v_current_response,
      'created_at', v_created_at,
      'updated_at', v_updated_at
    );
  end if;

  update public.proposal_responses
     set response = p_response
   where proposal_id = v_session.proposal_id
  returning updated_at into v_updated_at;

  return jsonb_build_object(
    'status', 'updated',
    'response', p_response,
    'created_at', v_created_at,
    'updated_at', v_updated_at
  );
end;
$$;

-- Only service_role may execute these functions.
revoke all on function public.api_check_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.api_reset_rate_limit(text) from public, anon, authenticated;
revoke all on function public.api_create_invitation_session(text, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.api_use_invitation_session(text) from public, anon, authenticated;
revoke all on function public.api_get_response(text, text) from public, anon, authenticated;
revoke all on function public.api_submit_response(text, text, text) from public, anon, authenticated;
revoke all on function public.api_update_response(text, text, text) from public, anon, authenticated;

grant execute on function public.api_check_rate_limit(text, integer, integer) to service_role;
grant execute on function public.api_reset_rate_limit(text) to service_role;
grant execute on function public.api_create_invitation_session(text, text, timestamptz, text) to service_role;
grant execute on function public.api_use_invitation_session(text) to service_role;
grant execute on function public.api_get_response(text, text) to service_role;
grant execute on function public.api_submit_response(text, text, text) to service_role;
grant execute on function public.api_update_response(text, text, text) to service_role;
