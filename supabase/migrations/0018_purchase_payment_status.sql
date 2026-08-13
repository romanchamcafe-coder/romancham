-- ============================================================
-- Purchases: let staff mark a vendor bill Paid / Unpaid.
-- The AI "unpaid vendor bills" insight and the P&L/notifications already
-- read purchases.payment_status, but nothing could change it (post_purchase
-- always writes 'unpaid'). This adds a paid_on date and a tiny authorized RPC
-- so the register can flip a bill's status. Marking Paid drops the payable.
-- ============================================================

alter table purchases add column if not exists paid_on date;

create or replace function public.set_purchase_payment(p_id uuid, p_status text, p_paid_on date default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select org_id into v_org from purchases where id = p_id;
  if v_org is null then raise exception 'not_found'; end if;
  if my_role(v_org) not in ('owner','manager','accountant') then raise exception 'forbidden'; end if;
  if p_status not in ('paid','unpaid','partial') then raise exception 'bad_status'; end if;

  update purchases
     set payment_status = p_status::pay_status_t,
         paid_on = case when p_status = 'paid' then coalesce(p_paid_on, current_date) else null end
   where id = p_id;
end; $$;

grant execute on function public.set_purchase_payment(uuid, text, date) to authenticated;
