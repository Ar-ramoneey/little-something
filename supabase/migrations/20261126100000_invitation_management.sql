-- Step 6: database-backed invitation management, non-content admin audit log,
-- and server-enforced atomic proposal reset.
-- Target: Supabase PostgreSQL (Postgres 15+).
-- Run after 20261126040000_admin_response_dashboard.sql.
--
-- The invitation code is stored only as a SHA-256 hex digest. The plaintext
-- code exists solely in the HTTPS response that generates it and in the email
-- an administrator explicitly sends. INVITATION_CODE remains a temporary
-- bootstrap fallback while invitation_settings.code_hash is null; once a
-- database-backed code exists, it is the only code the API accepts.

create table if not exists public.invitation_settings (
  singleton boolean primary key default true
    constraint invitation_settings_singleton check (singleton),
  code_hash text
    constraint invitation_settings_code_hash_format
      check (code_hash is null or code_hash ~ '^[0-9a-f]{64}$'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

insert into public.invitation_settings (singleton)
values (true)
on conflict (singleton) do nothing;

comment on table public.invitation_settings is
  'Single-row invitation state. Stores only a SHA-256 digest of the active code.';

create table if not exists public.admin_audit_events (
  id bigint generated always as identity primary key,
  event_type text not null
    constraint admin_audit_events_event_type_check check (event_type in (
      'code_generated', 'code_rotated', 'code_revoked',
      'access_enabled', 'access_disabled',
      'proposal_reset', 'invitation_email_sent', 'invitation_email_failed'
    )),
  actor_user_id uuid,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists admin_audit_events_occurred_at_idx
  on public.admin_audit_events (occurred_at desc);

comment on table public.admin_audit_events is
  'Non-content audit metadata for administrator actions. Never stores response values or response timestamps.';

alter table public.invitation_settings enable row level security;
alter table public.admin_audit_events enable row level security;

revoke all on table public.invitation_settings from public, anon, authenticated;
revoke all on table public.admin_audit_events from public, anon, authenticated;
grant all on table public.invitation_settings to service_role;
grant all on table public.admin_audit_events to service_role;

-- Defense in depth. The API verifies the JWT with Supabase Auth first; every
-- mutating RPC re-checks that the authenticated user still has the admin claim.
create or replace function public.assert_proposal_admin(p_admin_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_admin_user_id is null
     or not exists (
       select 1
         from auth.users u
        where u.id = p_admin_user_id
          and coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin'
     ) then
    raise exception 'Administrator authorization failed.'
      using errcode = 'insufficient_privilege';
  end if;
end;
$$;

create or replace function public.api_revoke_all_invitation_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.invitation_sessions
     set revoked_at = now()
   where revoked_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Status for the admin dashboard. Deliberately excludes code_hash and any code.
-- Records non-content metadata for email sends. The API has already verified
-- the admin JWT; this helper keeps the write atomic and service-role only.
create or replace function public.api_log_admin_event(
  p_event_type text,
  p_admin_user_id uuid,
  p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admin_audit_events (event_type, actor_user_id, details)
  values (p_event_type, p_admin_user_id, coalesce(p_details, '{}'::jsonb));
  return jsonb_build_object('status', 'logged');
end;
$$;

create or replace function public.api_get_invitation_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'enabled', s.enabled,
    'initialized', s.code_hash is not null,
    'status', case
      when s.code_hash is null then 'not_initialized'
      when not s.enabled then 'disabled'
      else 'active'
    end,
    'created_at', s.created_at,
    'updated_at', s.updated_at,
    'revoked_at', s.revoked_at
  )
  from public.invitation_settings s
  where s.singleton;
$$;

-- Generates or replaces the active code and invalidates every existing session.
create or replace function public.api_rotate_invitation_code(
  p_code_hash text,
  p_admin_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_was_initialized boolean;
  v_revoked_sessions integer;
  v_now timestamptz := now();
begin
  perform public.assert_proposal_admin(p_admin_user_id);

  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  select code_hash is not null
    into v_was_initialized
    from public.invitation_settings
   where singleton;

  if not found then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  update public.invitation_settings
     set code_hash = p_code_hash,
         enabled = true,
         revoked_at = null,
         created_at = v_now,
         updated_at = v_now
   where singleton;

  v_revoked_sessions := public.api_revoke_all_invitation_sessions();

  insert into public.admin_audit_events (event_type, actor_user_id, details)
  values (
    case when v_was_initialized then 'code_rotated' else 'code_generated' end,
    p_admin_user_id,
    jsonb_build_object('sessions_revoked', v_revoked_sessions)
  );

  return jsonb_build_object(
    'status', 'updated',
    'updated_at', v_now,
    'sessions_revoked', v_revoked_sessions
  );
end;
$$;

-- Invalidates the current code. A new code must be generated to restore access.
create or replace function public.api_revoke_invitation_code(p_admin_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revoked_sessions integer;
  v_now timestamptz := now();
begin
  perform public.assert_proposal_admin(p_admin_user_id);

  update public.invitation_settings
     set code_hash = null,
         revoked_at = v_now,
         updated_at = v_now
   where singleton;

  v_revoked_sessions := public.api_revoke_all_invitation_sessions();

  insert into public.admin_audit_events (event_type, actor_user_id, details)
  values (
    'code_revoked',
    p_admin_user_id,
    jsonb_build_object('sessions_revoked', v_revoked_sessions)
  );

  return jsonb_build_object(
    'status', 'revoked',
    'updated_at', v_now,
    'sessions_revoked', v_revoked_sessions
  );
end;
$$;

-- Enables or disables invitation access. Disabling also revokes active sessions.
create or replace function public.api_set_invitation_access(
  p_enabled boolean,
  p_admin_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_initialized boolean;
  v_revoked_sessions integer := 0;
  v_now timestamptz := now();
begin
  perform public.assert_proposal_admin(p_admin_user_id);

  if p_enabled is null then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  select code_hash is not null
    into v_initialized
    from public.invitation_settings
   where singleton;

  if p_enabled and not v_initialized then
    return jsonb_build_object('status', 'code_required');
  end if;

  update public.invitation_settings
     set enabled = p_enabled,
         updated_at = v_now
   where singleton;

  if not p_enabled then
    v_revoked_sessions := public.api_revoke_all_invitation_sessions();
  end if;

  insert into public.admin_audit_events (event_type, actor_user_id, details)
  values (
    case when p_enabled then 'access_enabled' else 'access_disabled' end,
    p_admin_user_id,
    jsonb_build_object('sessions_revoked', v_revoked_sessions)
  );

  return jsonb_build_object(
    'status', 'updated',
    'enabled', p_enabled,
    'updated_at', v_now,
    'sessions_revoked', v_revoked_sessions
  );
end;
$$;

-- Atomic, scoped reset. Does not touch invitation settings unless a new code
-- hash is explicitly supplied by the administrator. Audit details contain only
-- row counts, never deleted response values or response timestamps.
create or replace function public.api_reset_proposal_data(
  p_admin_user_id uuid,
  p_proposal_id text,
  p_new_code_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notifications integer;
  v_history integer;
  v_responses integer;
  v_sessions integer;
  v_rate_limits integer;
  v_code_rotated boolean := false;
  v_now timestamptz := now();
begin
  perform public.assert_proposal_admin(p_admin_user_id);

  if p_proposal_id is null or length(p_proposal_id) = 0
     or (p_new_code_hash is not null and p_new_code_hash !~ '^[0-9a-f]{64}$') then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  delete from public.response_notifications
   where proposal_id = p_proposal_id;
  get diagnostics v_notifications = row_count;

  delete from public.proposal_response_history
   where response_id in (
     select id from public.proposal_responses where proposal_id = p_proposal_id
   );
  get diagnostics v_history = row_count;

  delete from public.proposal_responses
   where proposal_id = p_proposal_id;
  get diagnostics v_responses = row_count;

  delete from public.invitation_sessions
   where proposal_id = p_proposal_id;
  get diagnostics v_sessions = row_count;

  delete from public.invitation_rate_limits
   where key like 'invite-code:%'
      or key like 'response-read:%'
      or key like 'response-write:%';
  get diagnostics v_rate_limits = row_count;

  if p_new_code_hash is not null then
    update public.invitation_settings
       set code_hash = p_new_code_hash,
           enabled = true,
           revoked_at = null,
           created_at = v_now,
           updated_at = v_now
     where singleton;
    v_code_rotated := true;
  end if;

  insert into public.admin_audit_events (event_type, actor_user_id, details)
  values (
    'proposal_reset',
    p_admin_user_id,
    jsonb_build_object(
      'notifications_deleted', v_notifications,
      'history_deleted', v_history,
      'responses_deleted', v_responses,
      'sessions_deleted', v_sessions,
      'rate_limits_deleted', v_rate_limits,
      'code_rotated', v_code_rotated
    )
  );

  return jsonb_build_object(
    'status', 'reset',
    'notifications_deleted', v_notifications,
    'history_deleted', v_history,
    'responses_deleted', v_responses,
    'sessions_deleted', v_sessions,
    'rate_limits_deleted', v_rate_limits,
    'code_rotated', v_code_rotated
  );
end;
$$;

-- Read-only counts shown before a destructive reset. No row content is returned.
create or replace function public.api_get_reset_preview(p_proposal_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'responses', (
      select count(*) from public.proposal_responses where proposal_id = p_proposal_id
    ),
    'history', (
      select count(*)
        from public.proposal_response_history h
        join public.proposal_responses r on r.id = h.response_id
       where r.proposal_id = p_proposal_id
    ),
    'notifications', (
      select count(*) from public.response_notifications where proposal_id = p_proposal_id
    ),
    'sessions', (
      select count(*) from public.invitation_sessions where proposal_id = p_proposal_id
    ),
    'rate_limits', (
      select count(*)
        from public.invitation_rate_limits
       where key like 'invite-code:%'
          or key like 'response-read:%'
          or key like 'response-write:%'
    )
  );
$$;

-- Lets the send endpoint reject a stale code before emailing it.
create or replace function public.api_is_active_invitation_code(p_code_hash text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select s.enabled and s.code_hash is not null and s.code_hash = p_code_hash
      from public.invitation_settings s
     where s.singleton
  ), false);
$$;

-- Verifies the database-backed code and creates the session in one RPC, with
-- one rate-limit check. 'legacy_required' tells the API to fall back to the
-- bootstrap environment code while no database-backed code exists.
create or replace function public.api_verify_invitation_and_create_session(
  p_code_hash text,
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
  v_settings public.invitation_settings%rowtype;
begin
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$'
     or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
     or p_proposal_id is null or length(p_proposal_id) = 0
     or p_expires_at is null or p_expires_at <= now() then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  v_allowed := public.api_check_rate_limit(p_rate_limit_key, 5, 900);
  if not v_allowed then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  select * into v_settings
    from public.invitation_settings
   where singleton;

  if not found or v_settings.code_hash is null then
    return jsonb_build_object('status', 'legacy_required');
  end if;

  if not v_settings.enabled then
    return jsonb_build_object('status', 'disabled');
  end if;

  if v_settings.code_hash <> p_code_hash then
    return jsonb_build_object('status', 'invalid_code');
  end if;

  update public.invitation_sessions
     set revoked_at = now()
   where proposal_id = p_proposal_id
     and revoked_at is null;

  insert into public.invitation_sessions (token_hash, proposal_id, expires_at)
  values (p_token_hash, p_proposal_id, p_expires_at);

  perform public.api_reset_rate_limit(p_rate_limit_key);

  return jsonb_build_object('status', 'created', 'expires_at', p_expires_at);
exception when unique_violation then
  return jsonb_build_object('status', 'invalid_request');
end;
$$;

-- Only service_role may execute these functions. Browser roles never can.
revoke all on function public.assert_proposal_admin(uuid) from public, anon, authenticated;
revoke all on function public.api_revoke_all_invitation_sessions() from public, anon, authenticated;
revoke all on function public.api_get_invitation_status() from public, anon, authenticated;
revoke all on function public.api_get_reset_preview(text) from public, anon, authenticated;
revoke all on function public.api_is_active_invitation_code(text) from public, anon, authenticated;
revoke all on function public.api_log_admin_event(text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.api_rotate_invitation_code(text, uuid) from public, anon, authenticated;
revoke all on function public.api_revoke_invitation_code(uuid) from public, anon, authenticated;
revoke all on function public.api_set_invitation_access(boolean, uuid) from public, anon, authenticated;
revoke all on function public.api_reset_proposal_data(uuid, text, text) from public, anon, authenticated;
revoke all on function public.api_verify_invitation_and_create_session(text, text, text, timestamptz, text) from public, anon, authenticated;

grant execute on function public.assert_proposal_admin(uuid) to service_role;
grant execute on function public.api_revoke_all_invitation_sessions() to service_role;
grant execute on function public.api_get_invitation_status() to service_role;
grant execute on function public.api_get_reset_preview(text) to service_role;
grant execute on function public.api_is_active_invitation_code(text) to service_role;
grant execute on function public.api_log_admin_event(text, uuid, jsonb) to service_role;
grant execute on function public.api_rotate_invitation_code(text, uuid) to service_role;
grant execute on function public.api_revoke_invitation_code(uuid) to service_role;
grant execute on function public.api_set_invitation_access(boolean, uuid) to service_role;
grant execute on function public.api_reset_proposal_data(uuid, text, text) to service_role;
grant execute on function public.api_verify_invitation_and_create_session(text, text, text, timestamptz, text) to service_role;
