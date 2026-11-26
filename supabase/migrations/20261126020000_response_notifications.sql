-- Step 3: Resend notification outbox and atomic notification enqueueing.
-- Target: Supabase PostgreSQL (Postgres 15+).
-- Run after 20261126010000_invitation_sessions.sql.
--
-- Each response history row gets exactly one notification row. The API claims
-- pending rows, sends through Resend with a stable Idempotency-Key, then records
-- sent/failed status. Email provider failures never roll back the response.

create table if not exists public.response_notifications (
  id uuid primary key default gen_random_uuid(),
  history_id uuid not null unique
    references public.proposal_response_history (id) on delete cascade,
  response_id uuid not null
    references public.proposal_responses (id) on delete cascade,
  proposal_id text not null,
  event_type text not null
    constraint response_notifications_event_type_check check (event_type in ('initial', 'changed')),
  previous_response text
    constraint response_notifications_previous_response_check check (previous_response in ('yes', 'thinking', 'no')),
  new_response text not null
    constraint response_notifications_new_response_check check (new_response in ('yes', 'thinking', 'no')),
  occurred_at timestamptz not null default now(),
  status text not null default 'pending'
    constraint response_notifications_status_check check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0
    constraint response_notifications_attempts_check check (attempts >= 0),
  idempotency_key text not null unique
    constraint response_notifications_idempotency_key_not_empty check (length(idempotency_key) > 0),
  provider_message_id text,
  last_error text,
  next_attempt_at timestamptz,
  locked_until timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists response_notifications_status_idx
  on public.response_notifications (status, next_attempt_at);

create index if not exists response_notifications_response_id_idx
  on public.response_notifications (response_id);

comment on table public.response_notifications is
  'Durable outbox for response emails. One row per response history event.';

alter table public.response_notifications enable row level security;

revoke all on table public.response_notifications from public, anon, authenticated;
grant all on table public.response_notifications to service_role;

-- Atomically claim rows for delivery across concurrent function invocations.
create or replace function public.api_claim_notifications(
  p_limit integer default 10,
  p_lock_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := 10;
  v_lock_seconds integer := 60;
  v_rows jsonb;
begin
  if p_limit is not null and p_limit between 1 and 50 then
    v_limit := p_limit;
  end if;

  if p_lock_seconds is not null and p_lock_seconds between 10 and 300 then
    v_lock_seconds := p_lock_seconds;
  end if;

  with claimed as (
    update public.response_notifications n
       set status = 'processing',
           locked_until = now() + make_interval(secs => v_lock_seconds),
           attempts = n.attempts + 1,
           updated_at = now()
     where n.status in ('pending', 'failed')
       and n.attempts < 5
       and (n.next_attempt_at is null or n.next_attempt_at <= now())
       and (n.locked_until is null or n.locked_until < now())
    returning n.*
  )
  select coalesce(jsonb_agg(to_jsonb(claimed) order by claimed.occurred_at), '[]'::jsonb)
    into v_rows
    from claimed;

  return v_rows;
end;
$$;

create or replace function public.api_mark_notification_sent(
  p_id uuid,
  p_provider_message_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.response_notifications
     set status = 'sent',
         sent_at = now(),
         provider_message_id = left(p_provider_message_id, 200),
         last_error = null,
         next_attempt_at = null,
         locked_until = null,
         updated_at = now()
   where id = p_id
     and status = 'processing';

  return found;
end;
$$;

create or replace function public.api_mark_notification_failed(
  p_id uuid,
  p_error text,
  p_retry_delay_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retry_delay integer := 300;
begin
  if p_retry_delay_seconds is not null and p_retry_delay_seconds between 60 and 86400 then
    v_retry_delay := p_retry_delay_seconds;
  end if;

  update public.response_notifications
     set status = 'failed',
         last_error = left(coalesce(p_error, 'Notification delivery failed.'), 1000),
         locked_until = null,
         next_attempt_at = case
           when attempts + 1 >= 5 then null
           else now() + make_interval(secs => v_retry_delay)
         end,
         updated_at = now()
   where id = p_id
     and status = 'processing';

  return found;
end;
$$;

-- Initial submission: enqueue one notification in the same transaction as the
-- response and its history row.
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
  v_response_id uuid;
  v_history_id uuid;
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
    returning id, created_at, updated_at into v_response_id, v_created_at, v_updated_at;
  exception when unique_violation then
    return jsonb_build_object('status', 'conflict');
  end;

  select id
    into v_history_id
    from public.proposal_response_history
   where response_id = v_response_id
     and previous_response is null
     and new_response = p_response
   order by changed_at desc
   limit 1;

  if v_history_id is null then
    raise exception 'Response history row missing after initial submission.';
  end if;

  insert into public.response_notifications
    (history_id, response_id, proposal_id, event_type, previous_response, new_response, occurred_at, idempotency_key)
  values
    (v_history_id, v_response_id, v_session.proposal_id, 'initial', null, p_response, v_created_at, 'response-initial:' || v_history_id::text);

  return jsonb_build_object(
    'status', 'created',
    'response', p_response,
    'created_at', v_created_at,
    'updated_at', v_updated_at
  );
end;
$$;

-- Answer change: enqueue one changed notification only when the value changes.
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
  v_response_id uuid;
  v_current_response text;
  v_created_at timestamptz;
  v_updated_at timestamptz;
  v_history_id uuid;
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

  select id, response, created_at, updated_at
    into v_response_id, v_current_response, v_created_at, v_updated_at
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

  select id
    into v_history_id
    from public.proposal_response_history
   where response_id = v_response_id
     and previous_response = v_current_response
     and new_response = p_response
   order by changed_at desc
   limit 1;

  if v_history_id is null then
    raise exception 'Response history row missing after response change.';
  end if;

  insert into public.response_notifications
    (history_id, response_id, proposal_id, event_type, previous_response, new_response, occurred_at, idempotency_key)
  values
    (v_history_id, v_response_id, v_session.proposal_id, 'changed', v_current_response, p_response, v_updated_at, 'response-change:' || v_history_id::text);

  return jsonb_build_object(
    'status', 'updated',
    'response', p_response,
    'created_at', v_created_at,
    'updated_at', v_updated_at
  );
end;
$$;

revoke all on function public.api_claim_notifications(integer, integer) from public, anon, authenticated;
revoke all on function public.api_mark_notification_sent(uuid, text) from public, anon, authenticated;
revoke all on function public.api_mark_notification_failed(uuid, text, integer) from public, anon, authenticated;

grant execute on function public.api_claim_notifications(integer, integer) to service_role;
grant execute on function public.api_mark_notification_sent(uuid, text) to service_role;
grant execute on function public.api_mark_notification_failed(uuid, text, integer) to service_role;

-- api_submit_response/api_update_response keep their existing service_role grants.
