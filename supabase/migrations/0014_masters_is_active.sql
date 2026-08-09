-- Fix: units and categories were created in 0001 without an is_active column,
-- but the app soft-deletes and filters these masters with `is_active = true`
-- (see server/actions/units.ts, server/actions/categories.ts, and the masters
-- queries). On a database built purely from migrations, the SELECT ... eq(is_active,true)
-- returns nothing (missing column) while the INSERT still succeeds — so newly
-- added units/categories never appear in the list or in dropdowns.
--
-- Add the column (default true) to match the convention used by the other
-- master tables (ingredients, vendors, branches, memberships, …).

alter table units      add column if not exists is_active boolean not null default true;
alter table categories add column if not exists is_active boolean not null default true;

-- Ensure any pre-existing rows are active.
update units      set is_active = true where is_active is null;
update categories set is_active = true where is_active is null;
