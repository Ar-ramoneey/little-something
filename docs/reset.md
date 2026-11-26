# Clean reset before the first real visitor

Use this once the deployment is verified and immediately before sharing the link with Roqeebah. It removes development and testing data while leaving the application exactly as it is: schema, admin account, Supabase Auth, environment configuration, invitation code, and website content are unchanged.

The reset is safe to repeat **until the first real answer is submitted**. Do not run it afterward, or the real answer will be deleted.

## What is deleted

| Table | Scope | Why |
| --- | --- | --- |
| `public.response_notifications` | `proposal_id = 'roqeebah-001'` | Removes test delivery history and outbox rows from the dashboard. |
| `public.proposal_response_history` | History of this proposal's response row | Removes old answers and timestamps from the timeline. |
| `public.proposal_responses` | `proposal_id = 'roqeebah-001'` | Removes the current test answer and its `created_at` / `updated_at`. |
| `public.invitation_sessions` | `proposal_id = 'roqeebah-001'` | Invalidates test invitation cookies. |
| `public.invitation_rate_limits` | Keys beginning `invite-code:`, `response-read:`, `response-write:` | Clears counters from failed-code testing that could block a fresh visitor. |

Deletes run inside one transaction, in dependency order (notifications → history → responses → sessions → rate limits). The script uses `DELETE` only: no `TRUNCATE`, no schema changes, no `DROP`, no writes to `auth.*`, and no secrets.

## What is preserved

- All five tables, columns, indexes, triggers, functions, and RLS policies.
- The admin user and its trusted `app_metadata.role = 'admin'` claim, plus all Supabase Auth sessions.
- Supabase, Resend, and Vercel configuration, including `INVITATION_CODE` and `SESSION_SECRET`.
- Rows for any other `proposal_id` and rate-limit keys with unrelated prefixes.
- All frontend content and files.

## How to run

1. Open the Supabase project that backs the deployed site.
2. Go to **SQL Editor → New query**.
3. Paste the full contents of [`supabase/reset_proposal_data.sql`](../supabase/reset_proposal_data.sql).
4. If `PROPOSAL_ID` / `VITE_PROPOSAL_ID` were overridden in Vercel, replace every `roqeebah-001` literal in the script with the configured value first.
5. Click **Run** and run the whole file as one query so the transaction is committed once.

The script ends with three verification result sets:

- Five rows showing `remaining_rows = 0` for each data set.
- The admin account still listed with `app_role = 'admin'`.
- All five table names still present.

If any statement fails, the transaction rolls back and nothing is deleted.

## Post-reset production checks

Admin dashboard:

1. Hard-refresh `/admin/login` and sign in with the real admin account.
2. Open `/admin/responses`. Confirm **"Waiting for a response."** and **"Your little surprise is waiting for its answer."**
3. Confirm the history timeline is empty, notification counts are zero, and no old timestamps are visible.

Fresh visitor flow:

1. In a new incognito/private browser window, open the production URL and complete the welcome → envelope → letter → invitation flow.
2. Enter the real invitation code and confirm the proposal screen appears.
3. Submit an answer and confirm the matching confirmation screen.
4. Reopen the site in the same browser and confirm the saved answer is shown.
5. Confirm one notification email arrives at the real admin recipient.
6. Reload `/admin/responses` and confirm the new answer, one history entry, and one notification row.

If any check fails, capture the browser console and the Vercel **Functions → Runtime Logs** entry rather than re-running the reset blindly.

## Notes

- A browser that still holds an old test cookie will be asked for the invitation code again, because its session row was deleted. That is expected.
- Browser-side state is not modified; a hard refresh is enough to show the empty dashboard.
- Rotating `INVITATION_CODE` or `SESSION_SECRET` is not part of this reset and only needs doing if those secrets were exposed or changed in Vercel.
