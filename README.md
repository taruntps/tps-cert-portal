# TPS Cert Portal

Internal portal for **TPS Xperts Global Certification Pvt Ltd** — NABCB-accredited certification body.

Built with: **React 18 + Vite + Supabase + GitHub Pages** (`tpscert.com`)

---

## Setup: Step-by-step

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Project name: `tps-cert-portal`
3. Database password: save this securely
4. Region: `Southeast Asia (Singapore)` — closest to India

### 2. Run the Schema

1. In Supabase dashboard: **SQL Editor → New query**
2. Copy the entire contents of `schema.sql`
3. Paste and click **Run**
4. This creates all 14 tables, RLS policies, seed data (4 companies + 4 certs + 9 auditors)

### 3. Get Your API Keys

In Supabase: **Project Settings → API**

Copy:
- **Project URL** → `https://xxxx.supabase.co`
- **anon / public key** → `eyJ...`

### 4. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

⚠️ `.env.local` is git-ignored. Never commit real credentials.

### 5. Install and Run Locally

```bash
npm install
npm run dev
```

Opens at: `http://localhost:5173`

---

## Invite Your First User (Admin)

1. In Supabase: **Authentication → Users → Invite User**
2. Email: `tarun@tpsxperts.com`
3. After clicking **Send Invite**, immediately run:

```sql
-- Run in Supabase SQL Editor after inviting Tarun
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || 
    '{"full_name": "Tarun Pratap Singh", "role": "admin"}'::jsonb
WHERE email = 'tarun@tpsxperts.com';
```

4. Tarun receives email invite, sets a password, and signs in
5. The `handle_new_user()` trigger auto-creates the profile with `role: admin`

### Link Tarun's Auditor Record

After first login, run in Supabase SQL Editor:

```sql
UPDATE public.auditors
SET profile_id = (SELECT id FROM auth.users WHERE email = 'tarun@tpsxperts.com')
WHERE full_name = 'Tarun Pratap Singh';
```

---

## Invite Other Portal Users

For Virat Mishra (technical_manager):
```sql
-- 1. Invite via Supabase Auth > Users > Invite User
-- Email: virat@tpsxperts.com

-- 2. Then run:
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || 
    '{"full_name": "Virat Mishra", "role": "technical_manager"}'::jsonb
WHERE email = 'virat@tpsxperts.com';

-- 3. Link auditor record after first login:
UPDATE public.auditors
SET profile_id = (SELECT id FROM auth.users WHERE email = 'virat@tpsxperts.com')
WHERE full_name = 'Virat Mishra';
```

Supported roles: `admin`, `technical_manager`, `auditor`, `sales`

---

## Deploy to GitHub Pages (tpscert.com)

### Initial Setup

1. Create GitHub repo: `tps-cert-portal` (can be private)
2. Push code:
```bash
git init
git add .
git commit -m "Initial TPS Cert Portal"
git remote add origin https://github.com/YOUR_USERNAME/tps-cert-portal.git
git push -u origin main
```

3. In GitHub repo: **Settings → Pages → Source: Deploy from branch → gh-pages**

### Build and Deploy

```bash
npm run deploy
```

This runs `npm run build` then publishes the `dist` folder to the `gh-pages` branch.

### Point tpscert.com to GitHub Pages

In your DNS provider:
```
CNAME   www   YOUR_USERNAME.github.io
A       @     185.199.108.153
A       @     185.199.109.153
A       @     185.199.110.153
A       @     185.199.111.153
```

In GitHub Pages settings: set Custom Domain to `tpscert.com` and enable **Enforce HTTPS**.

⚠️ **The portal runs at the same domain as the public site.** Consider using a subdomain like `portal.tpscert.com` for Phase 2 to avoid conflicts. For Phase 1, if the public site is on GitHub Pages too, you'll need to manage routing carefully.

---

## Project Structure

```
tps-cert-portal/
├── schema.sql                    ← Run this in Supabase
├── public/
│   ├── logo.png                  ← TPS logo (black-bg PNG)
│   ├── 404.html                  ← GitHub Pages SPA fix
│   └── CNAME                     ← Custom domain
└── src/
    ├── contexts/AuthContext.jsx   ← Session + profile state
    ├── components/
    │   ├── layout/               ← AppShell, Sidebar, TopBar
    │   └── shared/               ← ProtectedRoute, StatCard
    └── pages/
        ├── Login.jsx
        ├── Unauthorized.jsx
        └── dashboard/
            ├── AdminDashboard.jsx
            ├── TechManagerDashboard.jsx
            ├── AuditorDashboard.jsx
            └── SalesDashboard.jsx
```

---

## Phase 2 Modules (ready to add)

Routes are already in the Sidebar — just build the page components:

| Route | Module | Priority |
|-------|--------|----------|
| `/companies` | Company management | High |
| `/certifications` | Cert CRUD + docs | High |
| `/audit-files` | Audit assignment management | High |
| `/ncs` | Full NC lifecycle | High |
| `/compliance` | Compliance planner full CRUD | Medium |
| `/auditors` | Auditor management | Medium |
| `/documents` | Google Drive integration | Medium |
| `/committees` | MRM/Committee records | Low |
| `/enquiries` | Sales pipeline CRUD | Medium |
| `/reports` | Analytics & reporting | Low |

---

## Logo Note

The TPS logo (`logo.png`) has a black background. On dark panels (sidebar, login), 
`mix-blend-mode: screen` in the CSS makes the black transparent. On white backgrounds, 
replace with a transparent PNG version for best results.

---

## Known Phase 1 Limitations

- No CRUD yet — dashboards are read-only
- No Google Drive integration yet (drive_documents table is ready, queries pending)
- No email notifications
- Mobile sidebar requires hamburger menu (Phase 2)
