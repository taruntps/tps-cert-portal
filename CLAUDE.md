# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**TPS Cert Portal** — internal management portal for **TPS Xperts Global Certification Pvt Ltd**, a NABCB-accredited certification body. It manages the ISO/IEC 17021 certification lifecycle: companies, certifications, auditors, audit assignments, nonconformities, the compliance calendar, committees (impartiality/certification/MRM), and a sales enquiry pipeline. It also includes an AI "Knowledge" assistant (RAG over the org's Google Drive documents).

Internal-only (`<meta robots="noindex">`), served at **tpscert.com**.

## Commands

```bash
npm install        # install deps
npm run dev        # Vite dev server → http://localhost:5173
npm run build      # production build → dist/
npm run preview    # serve the built dist/ locally
npm run deploy      # manual: gh-pages -d dist (CI usually handles deploy)
```

There is **no lint and no test setup** — no test runner, no `.eslintrc`. Don't claim tests pass; there are none to run.

**Environment:** the app reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env.local` (copy `.env.example`). `src/lib/supabase.js` throws on startup if either is missing. New-user provisioning is manual (invite via Supabase dashboard + a SQL `UPDATE` to set role) — there is **no public signup**; see `README.md`.

## Architecture

React 18 + Vite 5 SPA, Supabase for auth + Postgres, React Router 6. Entry chain: `index.html` → `src/main.jsx` → `src/App.jsx`.

### Auth & role-based routing (the core pattern)

- `src/contexts/AuthContext.jsx` wraps the whole app. On load it calls `supabase.auth.getSession()`, subscribes to `onAuthStateChange`, and — crucially — fetches the user's row from the **`profiles`** table to get their `role`. `user` (Supabase auth) and `profile` (app data incl. role) are distinct; most authorization keys off `profile.role`.
- `src/components/shared/ProtectedRoute.jsx` gates all authenticated routes on `user`.
- `src/App.jsx` has essentially one real page — `/dashboard` — whose content is chosen by **`DashboardRouter`**, a switch on `profile.role`. The four roles each get their own dashboard component under `src/pages/dashboard/`:
  - `admin` → `AdminDashboard`
  - `technical_manager` → `TechManagerDashboard`
  - `auditor` → `AuditorDashboard`
  - `sales` → `SalesDashboard`
- `src/components/layout/AppShell.jsx` (with `Sidebar` + `TopBar`) is the layout wrapper for protected pages. `AskAIWidget` renders on all authenticated pages.

When adding a role-restricted feature, the pattern is: gate the route in `App.jsx`, branch on `profile.role`, and back it with an RLS policy in `schema.sql` (client checks are UX only; RLS is the real enforcement).

### Database — `schema.sql` is the source of truth

The entire Postgres schema lives in `schema.sql` (run manually in the Supabase SQL Editor — there are no migration tooling/files). It defines ~14 tables, several `ENUM` types (`user_role`, `cert_type`, `audit_type`, `nc_status`, `enquiry_status`, etc.), and is the domain model: `profiles`, `auditors`, `companies`, `certifications`, `audit_assignments`, `audit_team_members`, `witness_audits`, `nonconformities`, `compliance_calendar`, `internal_audits`, `committees`, `enquiries`, `drive_documents`, `notifications`.

Key DB conventions to preserve:
- **RLS is enabled on every table.** Policies use the `public.my_role()` `SECURITY DEFINER` helper to read the caller's role without recursing into `profiles` RLS. Any new table needs `ENABLE ROW LEVEL SECURITY` + policies.
- A `handle_new_user()` trigger on `auth.users` auto-creates the `profiles` row, defaulting `role` to `'auditor'` (overridable via the invite's `raw_user_meta_data`). If a profile is missing, the app's `fetchProfile` returns null and the dashboard never resolves — check the trigger ran.
- `set_updated_at()` triggers maintain `updated_at` columns.

### Two backends

1. **Supabase**, called directly from the client via `@supabase/supabase-js` (`src/lib/supabase.js`) for all core auth and CRUD.
2. **A separate Node backend on Render** for the AI Knowledge feature — `src/services/knowledgeApi.js`, base `VITE_API_URL` (default `https://tps-cert-backend.onrender.com`). It exposes `/api/knowledge/*` (search, chat sessions, documents, feedback), `/api/sync/*` (Google Drive document sync), and `/api/admin/kb/*` (stats, reindex, logs, analytics, settings). It authenticates by pulling the Supabase access token out of `localStorage` and sending it as a Bearer token. This backend is **not in this repo**. Per `getAISettings()` it uses Claude `claude-sonnet-4-6` + Voyage `voyage-3-lite` embeddings over a Google Drive folder.

### Deployment

GitHub Actions (`.github/workflows/deploy.yml`) builds and deploys to **GitHub Pages on every push to `main`**. `npm run deploy` (gh-pages) is a manual fallback. `public/CNAME` sets the custom domain `tpscert.com`.

Because GitHub Pages has no SPA fallback, client-side routing relies on the **404.html redirect trick**: `public/404.html` encodes the path into a query string and `index.html` decodes it back into a React Router route. Keep both halves in sync if you touch routing/base path. `vite.config.js` uses `base: '/'`.

## Known issues & gotchas

- **`.env.local` is committed to git and there is no `.gitignore`.** This contradicts the README ("`.env.local` is git-ignored. Never commit real credentials"). The Supabase **anon key is public-by-design** (it ships in the client bundle; RLS is the actual data protection), so this specific key isn't a breach — but the missing `.gitignore` means any future server-side secret would leak, and `.DS_Store` files are also tracked. Recommend adding a `.gitignore` (`.env.local`, `.DS_Store`, `node_modules`, `dist`) and untracking those files.
- **Render free-tier cold starts:** the AI Knowledge backend sleeps when idle, so the first `knowledgeApi` call after inactivity is slow or may time out. Core app (Supabase) is unaffected.
- **Hardcoded Supabase project ref:** `knowledgeApi.js` reads the auth token from `localStorage['sb-ukpmypsuzuoecwpxavty-auth-token']`. That key embeds the Supabase project ref — if the Supabase project/URL ever changes, this lookup silently returns an empty token and AI calls fail unauthenticated. Keep it in sync with `VITE_SUPABASE_URL`.
- **`getAISettings()` returns hardcoded client-side defaults** (model, embedding model, `driveRootFolderId`, thresholds) rather than fetching from the backend — editing AI behavior may require changing both this and the backend.
- **No migration system:** schema changes mean editing `schema.sql` and running it in Supabase by hand. There's no drift detection between the file and the live DB.
