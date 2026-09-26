-- Permanently remove kitchen.romancham@gmail.com from Romancham (Supabase).
-- Run in Supabase → SQL Editor. Past entries this user made (purchases,
-- production, wastage, etc.) are KEPT — only their "done by" link is cleared.
do $$
declare v uuid; r record;
begin
  select id into v from auth.users where lower(email) = 'kitchen.romancham@gmail.com';
  if v is null then raise notice 'Account not found — nothing to delete'; return; end if;

  -- 1) Clear "created_by / done_by / approved_by ..." links so history rows stay.
  for r in
    select c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass and c.confdeltype <> 'c'
  loop
    execute format('update %s set %I = null where %I = $1', r.tbl, r.col, r.col) using v;
  end loop;

  -- 2) Remove invitations sent to this email.
  delete from public.invitations where lower(email) = 'kitchen.romancham@gmail.com';

  -- 3) Remove the empty workspace this account created by mistake (only if nobody else is in it).
  begin
    delete from public.organizations o
    where exists (select 1 from public.memberships m where m.org_id = o.id and m.user_id = v and m.role = 'owner')
      and not exists (select 1 from public.memberships m where m.org_id = o.id and m.user_id <> v);
  exception when others then
    raise notice 'Stray workspace not removed (%). It stays inactive and harmless.', sqlerrm;
  end;

  -- 4) Delete the login itself (profile + memberships + branch links cascade).
  delete from auth.users where id = v;
  raise notice 'kitchen.romancham@gmail.com deleted';
end $$;

-- Check: should return 0 rows
select id, email from auth.users where lower(email) = 'kitchen.romancham@gmail.com';
