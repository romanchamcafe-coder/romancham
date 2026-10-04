-- ============================================================
-- Romancham — pack content for items bought per pack/qty.
-- e.g. Epigamia Yogurt, base unit "qty" (one tub), 1 qty = 400 gms.
-- Lets recipes be written in grams/ml while purchases & stock stay per pack.
-- Stock logic is unchanged: item_recipe.qty is still stored in base units.
-- ============================================================
alter table public.ingredients add column if not exists pack_content_qty numeric(14,4);
alter table public.ingredients add column if not exists pack_content_unit_id uuid references public.units(id);
do $$ begin
  alter table public.ingredients add constraint ingredients_pack_content_chk
    check (pack_content_qty is null or pack_content_qty > 0);
exception when duplicate_object then null; end $$;
