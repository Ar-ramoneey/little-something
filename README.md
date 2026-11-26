# A Letter to Roqeebah ❤️

A small, personal web experience: a welcome note, an interactive envelope, a letter, and one question.

## Development

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

To use the server API and private admin login locally, copy `.env.example` to `.env` and fill in the values. The `.env` file is gitignored. Use the current Supabase key formats: `sb_publishable_…` for the browser publishable key and `sb_secret_…` for the server secret key. Browser variables are only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and the non-secret `VITE_PROPOSAL_ID`; never add a `VITE_` prefix to `SUPABASE_SECRET_KEY`, `SESSION_SECRET`, `RESEND_API_KEY`, or `INVITATION_CODE`.

The public frontend calls relative `/api` paths. During local development, Vite proxies them to `vercel dev` on `http://127.0.0.1:3000` (override with `API_PROXY_TARGET`).

## Scripts

- `npm run dev` — start the development server.
- `npm run build` — type-check and create the production build in `dist/`.
- `npm run preview` — preview the production build locally.
- `npm run lint` — run ESLint.

## Backend

Invitation verification, response storage, and admin email notifications are handled by Supabase, Resend, and server-only Vercel Functions at `/api/invitation/verify` and `/api/responses`. See:

- `docs/supabase-schema.md` — database schema, RLS, and SQL Editor setup.
- `docs/api.md` — API contract, environment variables, and deployment notes.
- `docs/admin-auth.md` — private admin login, trusted `app_metadata` role, and account setup.
- `docs/admin-dashboard.md` — private response dashboard at `/admin/responses`.

The public proposal flow now asks for the private invitation code before submission, saves all three answer options through the secure API, and supports changing a saved answer. The private admin area lives at `/admin/login`, `/admin`, and `/admin/responses`.

## Deployment (Vercel)

1. Push the project to a Git repository.
2. In Vercel, choose **Add New → Project** and import that repository.
3. Vercel detects Vite automatically. Confirm:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
   These are also set in `vercel.json`.
4. Run all five Supabase migrations listed in `docs/admin-auth.md`, in order.
5. Add every variable in `.env.example` to Vercel, including `SUPABASE_SECRET_KEY`, `SESSION_SECRET`, and `APP_URL`. Mirror only the Supabase URL and publishable key into `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`.
6. Use a verified Resend sender in `RESEND_FROM_EMAIL` and the real admin address in `ADMIN_NOTIFICATION_EMAIL`; do not invent either.
7. Create the initial admin user manually and assign `app_metadata.role = admin` as described in `docs/admin-auth.md`.
8. Deploy from the Vercel dashboard when you are ready. This project does not deploy automatically.

See `DEPLOYMENT.md` for the full dashboard checklist. After deployment, replace the relative `og:image` / `twitter:image` values in `index.html` with the absolute URL of `https://<your-domain>/og-preview.png` so social crawlers can resolve the preview image.
