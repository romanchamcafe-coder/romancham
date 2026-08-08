-- ============================================================
-- Romancham — Phase 10: POS Connectors
-- Connector registry + sync history. The existing pos_imports table is reused
-- as the unified sync-run log (CSV today; API connectors in future).
-- ============================================================

create table if not exists public.pos_connectors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  provider text not null check (provider in ('petpooja','dotpe','posist','urbanpiper','toast','square','generic')),
  status text not null default 'disconnected' check (status in ('connected','disconnected','error')),
  config jsonb not null default '{}',   -- non-secret settings only; API keys belong in server secrets
  last_sync_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (org_id, provider)
);

alter table public.pos_connectors enable row level security;
drop policy if exists pos_connectors_read on public.pos_connectors;
create policy pos_connectors_read on public.pos_connectors for select
  using (org_id in (select my_org_ids()));
drop policy if exists pos_connectors_write on public.pos_connectors;
create policy pos_connectors_write on public.pos_connectors for all
  using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));

-- Unify pos_imports as the sync-run history across providers/sources.
alter table pos_imports add column if not exists provider text not null default 'petpooja';
alter table pos_imports add column if not exists source text not null default 'csv'
  check (source in ('csv','api'));
create index if not exists pos_imports_org_created_idx on pos_imports(org_id, created_at desc);
