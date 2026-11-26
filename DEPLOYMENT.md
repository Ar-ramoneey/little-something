# Deploying A Letter to Roqeebah to Vercel

This guide is for deploying through the **Vercel web dashboard**. It does not deploy automatically and does not push code to GitHub.

## Project shape

- **Frontend:** React + Vite + TypeScript, built with `npm run build` into `dist/`.
- **API:** Vercel Functions in `api/invitation/verify.ts`, `api/invitation.ts`, and `api/responses.ts`, each declaring `runtime: 'nodejs'`. The Node.js major version is pinned to 22.x through `engines.node` in `package.json`.
- **Database:** Supabase Postgres with five migrations in `supabase/migrations/`.
- **Authentication:** Supabase Auth for the private admin area only.
- **Email:** Resend, called only from server-side code.

Browser API calls use relative paths (`/api/invitation/verify`, `/api/responses`). `vercel.json` keeps SPA fallback limited to `/admin` and `/admin/:path*`, so API requests are not rewritten to `index.html`. Static assets are served from `public/` and copied into `dist/`.

---

## 1. Create the Supabase project

1. Sign in to Supabase and choose **New project**.
2. Choose an organization, name, region, and a strong database password. Save the password in your private password manager.
3. Wait for the project to finish provisioning.
4. Open **Project Settings → API**. You will need:
   - `SUPABASE_URL` — the project URL.
   - `SUPABASE_PUBLISHABLE_KEY` — the current `sb_publishable_…` key. This is safe for the browser.
   - `SUPABASE_SECRET_KEY` — the current `sb_secret_…` key. This is server-only and bypasses RLS.
5. Do not use a legacy `service_role` JWT for new deployments. The code still accepts `SUPABASE_SERVICE_ROLE_KEY` as a local fallback only.

---

## 2. Run the database migrations

Open the Supabase **SQL Editor** and run these files in this exact order. Paste the full contents of each file into a new query and run it:

1. `supabase/migrations/20261126000000_proposal_responses.sql`
2. `supabase/migrations/20261126010000_invitation_sessions.sql`
3. `supabase/migrations/20261126020000_response_notifications.sql`
4. `supabase/migrations/20261126030000_admin_auth.sql`
5. `supabase/migrations/20261126040000_admin_response_dashboard.sql`

The migrations create response storage, append-only history, invitation sessions, rate limits, the notification outbox, admin RLS policies, and the admin outbox read policy. They are idempotent where applicable, but run them once, in order.

Afterward, confirm these tables exist under **Table Editor**:

- `proposal_responses`
- `proposal_response_history`
- `invitation_sessions`
- `invitation_rate_limits`
- `response_notifications`

---

## 3. Create the administrator account

1. In Supabase, go to **Authentication → Users → Add user**.
2. Choose email/password and enter the real administrator's email and a strong password.
3. Confirm the email if email confirmation is enabled.
4. In **SQL Editor**, grant the trusted admin role using `app_metadata` only:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com');
```

5. Do **not** put the role in `raw_user_meta_data`; users can edit that. The RLS policies only trust `app_metadata.role = 'admin'`.
6. Ask the administrator to sign in again after the claim is added so their JWT is refreshed.

No admin credentials are stored in this repository.

---

## 4. Configure Resend

1. Sign in to Resend and verify the domain that will send the notification emails.
2. Create an API key with permission to send email.
3. Decide the real admin recipient address. Do not invent it.
4. You will set:
   - `RESEND_API_KEY` — the Resend API key.
   - `RESEND_FROM_EMAIL` — a verified sender address on the domain.
   - `ADMIN_NOTIFICATION_EMAIL` — the real admin recipient.

Email failures are recorded in `response_notifications` and retried; they do not roll back a successful response.

---

## 5. Configure Vercel environment variables

In Vercel, open **Project Settings → Environment Variables** and add every variable below. Use `Production` at minimum; use separate Preview values only if you intentionally want preview deployments to send real email.

| Variable | Where it goes | Value source |
| --- | --- | --- |
| `SUPABASE_URL` | Server only | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Server config; mirrored to browser | `sb_publishable_…` key |
| `SUPABASE_SECRET_KEY` | Server only | `sb_secret_…` key |
| `INVITATION_CODE` | Server only | The real private invitation code |
| `SESSION_SECRET` | Server only | Long random string, at least 32 characters |
| `ADMIN_NOTIFICATION_EMAIL` | Server only | Real admin recipient |
| `RESEND_API_KEY` | Server only | Resend API key |
| `RESEND_FROM_EMAIL` | Server only | Verified Resend sender |
| `APP_URL` | Server only | Exact production origin, e.g. `https://your-domain.com` |
| `VITE_SUPABASE_URL` | Browser-safe | Same as `SUPABASE_URL` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser-safe | Same as `SUPABASE_PUBLISHABLE_KEY` |

Optional variables:

| Variable | Default | Notes |
| --- | --- | --- |
| `PROPOSAL_ID` | `roqeebah-001` | Keep in sync with `VITE_PROPOSAL_ID` if overridden. |
| `VITE_PROPOSAL_ID` | `roqeebah-001` | Non-secret identifier. |
| `INVITATION_SESSION_TTL_SECONDS` | `604800` | 7 days; allowed 60–2592000. |
| `RESEND_TIMEOUT_MS` | `5000` | Allowed 1000–30000. |
| `ADMIN_DASHBOARD_URL` | `<APP_URL>/admin/responses` | Optional override. |
| `ALLOWED_ORIGINS` | — | Optional alternative to `APP_URL` for multi-origin setups. |

Security rules:

- Never add `SUPABASE_SECRET_KEY`, `SESSION_SECRET`, `RESEND_API_KEY`, `INVITATION_CODE`, or any bearer token as a `VITE_` variable.
- `VITE_SUPABASE_PUBLISHABLE_KEY` is safe because it is a publishable key, not a secret.
- Rotating `SESSION_SECRET` invalidates all existing invitation sessions.
- Do not commit `.env` files. `.gitignore` excludes `.env`, `.env.*`, `*.env`, and `*.env.*` except `*.env.example`.

---

## 6. Import the GitHub repository into Vercel

1. Push the code to your GitHub repository when you are ready. This project has not been pushed or deployed automatically.
2. In Vercel, choose **Add New → Project**.
3. Select the repository and click **Import**.
4. Do not change the root directory; the app is at the repository root.

---

## 7. Configure the production build

Confirm these settings on the import screen or in **Project Settings → Build & Deployment**:

- **Framework Preset:** Vite.
- **Root Directory:** `./`.
- **Build Command:** `npm run build`.
- **Output Directory:** `dist`.
- **Install Command:** `npm install` (default).
- **Node.js Version:** 22.x, selected automatically from `engines.node` in `package.json`. Function `config.runtime` must be `'nodejs'`; Vercel does not accept version strings such as `nodejs22.x` there.

These are also declared in `vercel.json`:

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/admin", "destination": "/index.html" },
    { "source": "/admin/:path*", "destination": "/index.html" }
  ]
}
```

No catch-all rewrite is used, so `/api/invitation/verify`, `/api/invitation`, and `/api/responses` remain Vercel Functions. The plain `/api/invitation` route is a backward-compatible alias.

Vercel runs functions under `api/` as plain Node.js ES modules. Every relative import in `api/` and `server/` therefore includes the compiled `.js` extension, for example `import { getSupabaseConfig } from './env.js'`. The source files remain `.ts`; TypeScript's bundler resolution accepts the `.js` specifier. Do not remove those extensions, or the deployed functions will fail with `ERR_MODULE_NOT_FOUND`.

Functions must also use Vercel's supported export shape: named HTTP method exports (`GET`, `POST`, `PATCH`) or a default object with a `fetch` method. A bare `export default function` is loaded but never invoked, causing requests to hang until the platform timeout.

---

## 8. Deploy from the Vercel dashboard

1. Confirm all environment variables from section 5 are present.
2. Click **Deploy**.
3. Wait for the build and function compilation to finish.
4. Open the deployment and check the **Functions** tab. You should see:
   - `/api/invitation/verify`
   - `/api/invitation` (legacy alias)
   - `/api/responses`
5. If any variable changes later, use **Deployments → Redeploy** so functions pick up the new values.

---

## 9. Configure the production application URL

1. In Vercel, open **Project Settings → Domains**.
2. Add the production domain and complete DNS verification.
3. Set `APP_URL` to the exact final origin, for example `https://your-domain.com` or `https://your-project.vercel.app`. Do not include a trailing path.
4. Redeploy after changing `APP_URL`.
5. Admin notification emails will link to `<APP_URL>/admin/responses`.
6. Update `index.html` so `og:image` and `twitter:image` use the absolute production URL `https://<your-domain>/og-preview.png`.

---

## 10. Test the production application

### Public flow

1. Open `/` and confirm the welcome screen loads.
2. Open the envelope and confirm the letter appears.
3. Continue to the invitation screen.
4. Submit an invalid code and confirm the exact friendly validation error appears.
5. Submit the real code and confirm the proposal screen.
6. Test all three answers:
   - `Yes, I'd love to!` → celebration screen.
   - `I'd like some time to think.` → calm thinking screen.
   - `No, thank you.` → kind rejection screen.
7. Reopen the site in the same browser and confirm the saved answer is shown.
8. Use **Change my answer** and confirm the update confirmation appears and the new answer is saved.
9. Open the site in another browser or clear cookies and confirm re-verification is required.

### Admin flow

1. Open `/admin/login` directly and sign in with the admin account.
2. Confirm `/admin/responses` shows the current response, history, and notification status.
3. Confirm a non-admin account is shown as unauthorized.
4. Confirm **Log out** works.

### API and route checks

1. `GET /api/responses` without a cookie returns `401`.
2. `POST /api/responses` without an `Origin` header returns `403`.
3. `POST /api/responses` with a disallowed `Origin` returns `403`.
4. `/admin/responses` loads the SPA directly rather than a 404.
5. `/api/invitation/verify` returns a JSON response, not `index.html`.
6. `/favicon.svg` and `/og-preview.png` load successfully.
7. Browser DevTools → Application confirms no invitation code is in `localStorage` or `sessionStorage`.
8. Network responses contain no session token, code, or secret key.

### Email checks

1. Initial submission sends one email to the real admin recipient.
2. An answer change sends one update email.
3. The email subject is correct, includes the response and timestamp, and links to the admin dashboard.
4. The email does not include the invitation code, session token, or any secret.
5. If delivery fails, the response still succeeds and the outbox records the failure for retry.

---

## Outstanding requirements before deployment

The following cannot be completed from this workspace and must be supplied in the Vercel/Supabase/Resend dashboards:

- A pushed GitHub repository URL.
- Real Supabase URL, publishable key, and secret key.
- All five migrations applied to the live Supabase project.
- The real administrator email/password and `app_metadata.role = admin`.
- A real private invitation code.
- A long random `SESSION_SECRET`.
- A verified Resend sender and real Resend API key.
- The real admin notification recipient.
- The final production origin/domain.
- Manual production verification from section 10.

No credentials are included in this repository. `.env.example` contains placeholders only.
