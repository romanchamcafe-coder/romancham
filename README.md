# Brewmetrics

Multi-tenant SaaS for cafés, bakeries, restaurants & cloud kitchens — inventory, recipes, purchases, sales, expenses & analytics.
Stack: **Next.js 15 · TypeScript · Supabase · Tailwind · Vercel**.

> You're new to development — follow the steps in order and you'll have this running locally, then live on the internet. Each step says exactly what to type. If something errors, copy the error to me and we fix it together.

---

## What's in this batch (Phase 1 — foundation)

✅ Auth (sign up / login / sign out) with automatic organization + first branch creation
✅ Multi-tenant database with **Row-Level Security** (tenants can't see each other's data)
✅ Role-based access (Owner / Manager / Staff / Accountant)
✅ Full Phase-1 schema + the hard business logic in the database:
  - `post_purchase` — records a bill, auto-splits **GST (CGST/SGST vs IGST)**, adds stock + FIFO cost layers
  - `post_sale` — records a sale, **auto-consumes inventory via the recipe/BOM**, computes **COGS & Food Cost %**
  - `dashboard_metrics` — revenue, food cost %, profit, top/least sellers, low stock, trends, branch performance
✅ App shell (sidebar + branch switcher), live **Dashboard** with charts
✅ **Ingredients** and **Vendors** modules (the CRUD pattern for the rest)
🔜 Next batches: full Purchases UI, Sales + POS CSV import, Inventory screens, Expenses, Team/branch settings (DB & logic already built — just need their screens)

---

## Prerequisites (install once)

1. **Node.js 20+** — https://nodejs.org (download the LTS installer, click through it)
2. A **GitHub** account — https://github.com
3. A **Supabase** account — https://supabase.com (free tier is fine)
4. A **Vercel** account — https://vercel.com (sign in with GitHub)
5. A code editor — **VS Code** — https://code.visualstudio.com

---

## Step 1 — Create your Supabase project & database

1. Go to https://supabase.com → **New project**. Pick a name (e.g. `brewmetrics`), a strong DB password (save it), region **Mumbai/Singapore** (closest to India).
2. Wait ~2 minutes for it to provision.
3. In the left menu open **SQL Editor** → **New query**. Now run the three migration files **in order**. For each file: open it from `supabase/migrations/`, copy all the text, paste into the SQL editor, click **Run**.
   - `0001_schema.sql`  (creates all tables)
   - `0002_rls.sql`     (security + auth trigger)
   - `0003_functions.sql` (purchase/sale/dashboard logic)
   - *(optional)* `seed.sql` only **after** you've signed up once — see comments inside it.
4. Open **Settings → API**. Copy these three values (you'll need them next):
   - Project URL
   - `anon` public key
   - `service_role` secret key

---

## Step 2 — Run it on your computer

Open the project folder in VS Code, then open its **Terminal** (menu: Terminal → New Terminal) and run:

```bash
# 1. install dependencies (takes a few minutes the first time)
npm install

# 2. create your local secrets file
cp .env.example .env.local
```

Open `.env.local` and paste your three Supabase values:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Then start the app:

```bash
npm run dev
```

Open **http://localhost:3000** → you'll be sent to **/login** → click **Create an account**.

> **Email confirmation:** by default Supabase emails a confirmation link. For fast local testing, turn it off: Supabase → **Authentication → Providers → Email → "Confirm email" = OFF**. Then sign up and you go straight into the dashboard.

When you sign up, your **organization + Main Branch + Owner role** are created automatically. Add a few Ingredients and Vendors to see the modules working.

---

## Step 3 — Put it on GitHub

In the terminal, inside the project folder:

```bash
git init
git add .
git commit -m "Brewmetrics Phase 1"
```

Create an empty repo at https://github.com/new (name it `brewmetrics`, keep it private). GitHub shows you two lines to run — they look like:

```bash
git remote add origin https://github.com/YOUR-USERNAME/brewmetrics.git
git branch -M main
git push -u origin main
```

---

## Step 4 — Deploy to Vercel (go live)

1. Go to https://vercel.com → **Add New → Project** → import your `brewmetrics` GitHub repo.
2. Before clicking Deploy, open **Environment Variables** and add the same four keys from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` → set this to your Vercel URL once you know it (e.g. `https://brewmetrics.vercel.app`)
3. Click **Deploy**. In ~1 minute you get a live URL.
4. Back in Supabase → **Authentication → URL Configuration** → add your Vercel URL to **Site URL** and **Redirect URLs**.

That's it — it's live. Every time you `git push` to `main`, Vercel auto-deploys the update.

---

## How the money logic works (so you can trust the numbers)

- **GST:** if the vendor's state = branch's state → CGST + SGST (rate split in half). Otherwise → IGST (full rate). Computed inside `post_purchase`.
- **Inventory:** never overwritten. Every change is a row in `inventory_movements` (a ledger). Current stock = the sum of that ledger. Purchases also create `inventory_cost_layers` for **FIFO** costing.
- **Sales → consumption:** posting a sale reads the menu item's active **recipe**, multiplies each ingredient by quantity sold (+ wastage ÷ yield), converts units, and depletes the **oldest cost layers first (FIFO)** to get accurate **COGS**.
- **Food Cost % = COGS ÷ Net Sales**, shown live on the dashboard.

---

## Project structure (quick map)

```
app/(auth)        login & signup
app/(app)         the authenticated app (dashboard, masters, etc.)
components/ui      buttons, inputs, cards, table (styled with Tailwind)
components/layout  sidebar + topbar
lib/supabase       database connection (server / browser / middleware)
lib/auth           session context + role permissions
server/actions     write operations (create ingredient, sale, etc.)
server/queries     read operations for pages
supabase/migrations  the database (run these in Supabase SQL editor)
```

---

## Troubleshooting

- **"No active organization"** → sign out and sign up again with email confirmation OFF (the org is created during signup).
- **Charts empty** → that's normal until you add purchases & sales. The dashboard fills as data comes in.
- **Build/typescript error** → run `npm run build` locally and send me the full message; we'll fix it.
- **Login loops back** → check your Supabase keys in `.env.local` are exact (no spaces), and that the URL has no trailing slash.

---

## Next steps with me

Tell me which to build next and I'll generate that module (UI + actions, the DB is ready):
1. **Purchases** entry screen (line items, GST preview, bill upload) — recommended first, it feeds inventory
2. **Sales** entry + **POS CSV import**
3. **Inventory** screens (current stock, adjustments, period close)
4. **Expenses** + **Team/branch settings** (invites)
5. **Recipes / BOM builder**
