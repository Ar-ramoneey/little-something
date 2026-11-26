-- Safe, repeatable clean reset before the first real visitor.
-- Target: the live Supabase Postgres project used by the Vercel deployment.
--
-- Run the whole file as ONE query in the Supabase SQL Editor. It:
--   * uses DELETE inside a single transaction (no TRUNCATE, no DDL, no drops);
--   * touches only rows belonging to this app's single proposal;
--   * never reads or writes secrets, auth.users, or website content.
--
-- IMPORTANT: if PROPOSAL_ID / VITE_PROPOSAL_ID were overridden in Vercel,
-- replace every 'roqeebah-001' literal below with the configured value first.
-- The default is defined in server/lib/env.ts and src/lib/adminData.ts.
--
-- Two verification result sets are included at the end. "remaining_rows" must
-- be 0 for all five data sets, and the admin check must still return a row with
-- app_role = 'admin'.

begin;

-- 1. Notification outbox / delivery history for this proposal.
--    Deleted first so no stale sent/failed rows remain in the admin dashboard.
delete from public.response_notifications
 where proposal_id = 'roqeebah-001';

-- 2. Response change history for this proposal's response row.
--    These rows would also cascade from step 3. Deleting them explicitly keeps
--    the order auditable and does not rely on a cascade being present.
delete from public.proposal_response_history
 where response_id in (
         select id
           from public.proposal_responses
          where proposal_id = 'roqeebah-001'
       );

-- 3. The current response row, including its created_at / updated_at timestamps.
delete from public.proposal_responses
 where proposal_id = 'roqeebah-001';

-- 4. Invitation sessions issued for this proposal. These are short-lived,
--    server-issued tokens, so removing them prevents reuse of any test cookie.
delete from public.invitation_sessions
 where proposal_id = 'roqeebah-001';

-- 5. Rate-limit counters used by the invitation and response endpoints.
--    Keys are '<prefix>:<sha256-of-ip>' (see server/lib/security.ts). Only the
--    three prefixes this app writes are removed; unrelated keys are preserved.
delete from public.invitation_rate_limits
 where key like 'invite-code:%'
    or key like 'response-read:%'
    or key like 'response-write:%';

commit;

-- Verification 1: each reset data set must report 0 remaining rows.
select 'response_notifications' as data_set,
       count(*) as remaining_rows
  from public.response_notifications
 where proposal_id = 'roqeebah-001'
union all
select 'proposal_response_history',
       count(*)
  from public.proposal_response_history h
  join public.proposal_responses r on r.id = h.response_id
 where r.proposal_id = 'roqeebah-001'
union all
select 'proposal_responses',
       count(*)
  from public.proposal_responses
 where proposal_id = 'roqeebah-001'
union all
select 'invitation_sessions',
       count(*)
  from public.invitation_sessions
 where proposal_id = 'roqeebah-001'
union all
select 'invitation_rate_limits',
       count(*)
  from public.invitation_rate_limits
 where key like 'invite-code:%'
    or key like 'response-read:%'
    or key like 'response-write:%';

-- Verification 2: the trusted admin account is untouched. Expect at least one
-- row with app_role = 'admin'. This query only reads; it never updates auth.
select id, email, coalesce(raw_app_meta_data ->> 'role', '') as app_role
  from auth.users
 where coalesce(raw_app_meta_data ->> 'role', '') = 'admin';

-- Verification 3: all five tables still exist (no DDL is performed by this reset).
select tablename
  from pg_tables
 where schemaname = 'public'
   and tablename in (
     'proposal_responses',
     'proposal_response_history',
     'invitation_sessions',
     'invitation_rate_limits',
     'response_notifications'
   )
 order by tablename;
