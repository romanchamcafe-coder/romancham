-- ============================================================
-- Romancham — Phase 11: Task Engine
-- Assignable operational tasks with due time, priority, completion.
-- ============================================================

create table if not exists public.ops_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  title text not null,
  task_type text not null default 'other'
    check (task_type in ('opening','closing','cleaning','food_safety','maintenance','production','inventory_count','vendor_followup','other')),
  priority text not null default 'medium' check (priority in ('critical','high','medium','low')),
  assigned_to uuid references profiles(id),
  due_at timestamptz,
  reminder_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references profiles(id),
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists ops_tasks_org_branch_idx on public.ops_tasks(org_id, branch_id, due_at);
create index if not exists ops_tasks_open_idx on public.ops_tasks(org_id, completed_at);

alter table public.ops_tasks enable row level security;

-- Read: any member with access to the branch. Write: any org member (staff must be
-- able to complete their own tasks); creation/assignment is done in the UI by managers.
drop policy if exists ops_tasks_read on public.ops_tasks;
create policy ops_tasks_read on public.ops_tasks for select
  using (org_id in (select my_org_ids()) and branch_id in (select my_branch_ids(org_id)));
drop policy if exists ops_tasks_write on public.ops_tasks;
create policy ops_tasks_write on public.ops_tasks for all
  using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
