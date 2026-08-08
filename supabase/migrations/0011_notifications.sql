-- ============================================================
-- Romancham — Phase 4: Notification Center
-- Turns the existing notifications table into an alert engine: stable dedupe
-- key, priority, title/body/link, and read state.
-- ============================================================

alter table notifications add column if not exists key text;
alter table notifications add column if not exists priority text not null default 'medium'
  check (priority in ('critical','high','medium','low'));
alter table notifications add column if not exists title text;
alter table notifications add column if not exists body text;
alter table notifications add column if not exists href text;
alter table notifications add column if not exists updated_at timestamptz not null default now();

-- One live alert per (org, key). NULL keys (legacy rows) don't conflict.
create unique index if not exists notifications_org_key_uidx on notifications(org_id, key);
create index if not exists notifications_org_unread_idx on notifications(org_id, read_at);

-- Any member of the org may write notifications (system alerts are non-sensitive);
-- read stays branch-scoped from the original policy.
drop policy if exists notifications_write on notifications;
create policy notifications_write on notifications for all
  using (org_id in (select my_org_ids())) with check (org_id in (select my_org_ids()));
