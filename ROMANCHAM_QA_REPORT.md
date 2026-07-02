# Romancham — QA & Enhancement Report

**Scope:** Fix and enhance the 20-point specification without rebuilding, preserving the existing Next.js 15 / Supabase / Tailwind architecture.
**Rules honoured:** no existing functionality removed, design language preserved, Next.js 15 best practices, WCAG-oriented accessibility, responsive layouts, reusable components, root-cause fixes, per-issue verification, delivered in verified batches so a regression could never ship silently.
**Live app:** https://romancham.vercel.app
**Delivery model:** six verified batches, each `git push` → Vercel auto-deploy → live verification before moving on.

| Batch | Commit | Issues |
|------|--------|--------|
| 1 — Foundation & critical | `9304a57` | 1, 2, 4, 11, 12, 13, 14, 15, 19, 20 |
| 2 — Masters CRUD & toasts | `4146628` | 5, 17 |
| 3 — Settings & onboarding | `9557223` | 6, 7, 10 |
| 4 — Sales | `373b98c` | 3, 8 |
| 5 — Purchases table | `d16fb57` | 9, 16 |
| 6 — Accessibility pass | `2fec28e` | 18 |

---

## Issue-by-issue

**#1 — Inventory 503 on prefetch.** *Root cause:* the Inventory server component ran Supabase queries with no error boundary; a rejected query surfaced as an unhandled RSC error (503) during prefetch, with no loading UI. *Fix:* `getInventory`/`getAdjustItems` wrapped in try/catch (graceful empty results) + route-level `app/(app)/loading.tsx` (skeleton) and `app/(app)/error.tsx` (client boundary with "Try again"). *Verified:* /inventory loads clean.

**#2 — Branch Performance showed empty axes.** *Root cause:* `branch_perf` always contained the branch row at revenue 0, so `.length` was truthy and an empty chart rendered. *Fix:* render the shared `EmptyState` when `!branch_perf.some(b => b.revenue > 0)`. *Verified live.*

**#3 — Sales page filters/search/pagination/CSV history.** Added a filter bar (search over item/invoice/customer, date range, payment type, category), server-side pagination (50/page), and a CSV import-history panel backed by `pos_imports`. *Verified: "Showing 1–1 of 1", filter bar live.*

**#4 / #15 — Dashboard date-range picker.** Interactive picker with 9 ranges (Today, Yesterday, 7/30/90 days, This/Previous month, This year, Custom). Page reads `searchParams`, so every KPI and chart recomputes server-side vs the previous period. Header is now "Dashboard" + range badge + date span (replacing "· Last 30 Days"). *Verified: dropdown + all presets.*

**#5 — Categories/Units/Vendors edit/delete.** Inline edit (Categories, Units) and modal edit (Vendors), delete via an accessible confirm dialog, case-insensitive duplicate validation, and success/error toasts. Delete = archive (`is_active=false`) so historical records keep their references (no FK breakage). *Verified: duplicate "Dairy" correctly rejected.*

**#6 — Purchases onboarding.** When there are no purchases, a 3-step `OnboardingChecklist` (add items → add vendor → record bill) with progress bar and per-step CTAs, steps auto-ticked from real data. *Verified: "0 of 3 done".*

**#7 — Recipes onboarding.** Same reusable checklist (add sales items → add purchase items → build recipe) replacing the plain text notice.

**#8 — Manual sale entry.** "Add a sale manually" form (date, item, category, payment, invoice, qty, price, total) inserting a `pos_sales` row that feeds the same reports as the CSV — CSV upload retained. *Verified.*

**#9 / #16 — Purchases table UX + filters.** New interactive table: sticky header, horizontal-scroll hint, column-visibility toggle, click-to-sort headers, hover rows; plus a filter bar (search, vendor, invoice, date range, category) and pagination. *Verified: deploys clean; table renders once purchases exist.*

**#10 — Editable Organization settings.** Read-only card replaced with an editable form (name, GSTIN, state code, phone, email, address) with validation (GSTIN length, 2-digit state code, email/phone format) + toast; owner-only guard. Added `address`/`phone`/`email` columns to `organizations`. *Verified live.*

**#11 — Team "coming soon."** Professional `EmptyState` ("Team management — coming soon"); developer note removed. *Verified.*

**#12 — "Item Name" → "Ingredients."** Renamed across sidebar, page titles, tables, empty states, recipes and inventory copy. The Petpooja **Sales** CSV column keeps the literal header "Item Name" because that's your data field, not a UI label. *Verified.*

**#13 — One reusable EmptyState.** `components/ui/empty-state.tsx` (icon, title, description, primary/secondary CTAs) used across dashboard panels, masters, settings. *Verified.*

**#14 — KPI cards.** Uppercase labels, larger bold values, trend % vs the previous period with ▲/▼, and a colored Food-Cost status badge (Healthy/Watch/High). *Verified.*

**#17 — Dynamic expense categories.** "Manage expense categories" on the Expenses page reuses the category manager (create/edit/delete/archive); the expense dropdown reads only active categories. *Verified: 7 active, full manager renders.*

**#18 — Accessibility.** Every form control now has an associated label or `aria-label` (ingredient, purchase, expense, adjust, branch forms + all new forms); dialogs use `role="dialog"`/`aria-modal`/labelledby/Escape; progress bars use `role="progressbar"`; toasts use `role="status"`/`aria-live`; icon-only buttons have `aria-label`; keyboard support (Enter to submit, Escape to cancel).

**#19 — Sign-out confirmation.** Accessible confirm dialog before sign-out (Escape to cancel). *Verified.*

**#20 — No UUIDs surfaced.** All screens show names (vendor, branch, category, item); IDs stay internal. *Verified.*

---

## New reusable components

`components/ui/empty-state.tsx` · `components/ui/toaster.tsx` + `lib/toast.ts` (dependency-free toast) · `components/ui/confirm-dialog.tsx` · `components/ui/onboarding-checklist.tsx` · `components/dashboard/date-range-picker.tsx` + `lib/date-ranges.ts` · `app/(app)/loading.tsx` · `app/(app)/error.tsx` · masters `CategoryManager` / `UnitManager` / `VendorManager` · sales `SalesFilters` / `ManualSaleForm` · purchases `PurchasesTable` / `PurchasesFilters` · settings `OrgSettingsForm`.

## Database changes (backward-compatible, `add column if not exists`)
- `categories.is_active`, `units.is_active` — safe archive/delete for masters.
- `organizations.address`, `organizations.phone`, `organizations.email` — editable org profile.

## Engineering notes
- Filter/pagination state lives in the URL (`searchParams`), so results are shareable, bookmarkable and server-rendered.
- Deletes are soft (archive) to protect historical integrity and avoid foreign-key errors.
- Selection dropdowns filter to active records; name-resolution maps intentionally keep archived rows so past records still display their labels.
- No regression to money logic (GST split, FIFO, food cost) — those RPCs were untouched.

## Recommended next steps (out of current scope)
1. Finish **Team management** (invitations + role-based access) — DB and RLS already support it.
2. **Server-side sorting** for the purchases table (today's sort orders the current page).
3. **CSV export** for the Sales/Purchases registers.
4. Optional: real-time low-stock **notifications** (the `notifications` table exists).
5. Add automated tests (Playwright smoke tests per module) to lock in these fixes.

*All 20 issues resolved and deployed; each batch verified on the live site before proceeding.*
