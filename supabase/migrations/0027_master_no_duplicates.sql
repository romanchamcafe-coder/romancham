-- ============================================================
-- Romancham — duplicate lock for master data.
-- Blocks creating / renaming / restoring a record whose name already
-- exists (active) in the same organisation. Comparison ignores case and
-- extra spaces ("  Potato " = "potato").
--   units       : name AND abbreviation must be unique
--   categories  : name unique within its type (ingredient / expense)
--   ingredients : name unique
--   vendors     : name unique, and GSTIN unique when filled
-- Implemented as triggers (not unique indexes) so the 2 existing duplicate
-- ingredients don't block the migration — they can still be edited; only
-- NEW duplicates are refused.
-- ============================================================

create or replace function public.master_norm(t text)
returns text language sql immutable as $$
  select lower(regexp_replace(btrim(coalesce(t, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.prevent_master_duplicates()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  j      jsonb := to_jsonb(NEW);
  o      jsonb := case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end;
  label  text  := TG_ARGV[0];
  dup    text;
  active boolean := coalesce((j->>'is_active')::boolean, true);
begin
  if not active then return NEW; end if;
  -- On update, only check when the identifying fields change or a record is restored.
  if TG_OP = 'UPDATE'
     and master_norm(j->>'name') = master_norm(o->>'name')
     and master_norm(j->>'abbr') = master_norm(o->>'abbr')
     and master_norm(j->>'gstin') = master_norm(o->>'gstin')
     and coalesce((o->>'is_active')::boolean, true) = active then
    return NEW;
  end if;

  execute format(
    'select name from %I.%I where org_id = $1 and id <> $2 and coalesce(is_active, true)
       and master_norm(name) = master_norm($3) %s limit 1',
    TG_TABLE_SCHEMA, TG_TABLE_NAME,
    case when TG_TABLE_NAME = 'categories' then 'and type::text = $4' else '' end)
  into dup using NEW.org_id, NEW.id, j->>'name', j->>'type';
  if dup is not null then
    raise exception using errcode = '23505',
      message = format('%s "%s" already exists — use the existing one instead of creating a duplicate.', label, dup);
  end if;

  if TG_TABLE_NAME = 'units' and master_norm(j->>'abbr') <> '' then
    select abbr into dup from units
     where org_id = NEW.org_id and id <> NEW.id and coalesce(is_active, true)
       and master_norm(abbr) = master_norm(j->>'abbr') limit 1;
    if dup is not null then
      raise exception using errcode = '23505',
        message = format('Unit abbreviation "%s" already exists — use the existing unit.', dup);
    end if;
  end if;

  if TG_TABLE_NAME = 'vendors' and master_norm(j->>'gstin') <> '' then
    select name into dup from vendors
     where org_id = NEW.org_id and id <> NEW.id and coalesce(is_active, true)
       and master_norm(gstin) = master_norm(j->>'gstin') limit 1;
    if dup is not null then
      raise exception using errcode = '23505',
        message = format('GSTIN %s already belongs to vendor "%s".', upper(btrim(j->>'gstin')), dup);
    end if;
  end if;

  return NEW;
end; $$;

drop trigger if exists trg_no_dup on public.units;
create trigger trg_no_dup before insert or update on public.units
  for each row execute function public.prevent_master_duplicates('Unit');
drop trigger if exists trg_no_dup on public.categories;
create trigger trg_no_dup before insert or update on public.categories
  for each row execute function public.prevent_master_duplicates('Category');
drop trigger if exists trg_no_dup on public.ingredients;
create trigger trg_no_dup before insert or update on public.ingredients
  for each row execute function public.prevent_master_duplicates('Ingredient');
drop trigger if exists trg_no_dup on public.vendors;
create trigger trg_no_dup before insert or update on public.vendors
  for each row execute function public.prevent_master_duplicates('Vendor');
