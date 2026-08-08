-- ============================================================
-- Romancham — Phase 3: Automatic Backups (versioned restore points)
-- Backups are built app-side (RLS-scoped) and stored here as JSONB snapshots.
-- Daily / weekly / monthly snapshots are created automatically on admin activity;
-- manual "Back up now" is always available. Restore is owner-only.
-- ============================================================

create table if not exists public.backups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  kind text not null default 'manual' check (kind in ('daily','weekly','monthly','manual')),
  payload jsonb not null,
  size_bytes bigint not null default 0,
  table_counts jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists backups_org_kind_idx on public.backups(org_id, kind, created_at desc);

alter table public.backups enable row level security;

-- Backups contain full org data → restrict read AND write to owners/admins.
drop policy if exists backups_read on public.backups;
create policy backups_read on public.backups for select using (public.role_is_admin(org_id));
drop policy if exists backups_write on public.backups;
create policy backups_write on public.backups for all
  using (public.role_is_admin(org_id)) with check (public.role_is_admin(org_id));
