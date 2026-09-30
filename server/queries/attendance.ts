import { createClient } from "@/lib/supabase/server";
import { canSeePay, monthBounds } from "@/lib/attendance";

export type StaffRow = { id: string; name: string; designation: string | null; phone: string | null; joined_on: string | null; is_active: boolean; sort_order: number };
export type AttRow = { staff_id: string; att_date: string; status: string; in_time: string | null; out_time: string | null; ot_hours: number; note: string | null };
export type PayRow = { staff_id: string; monthly_salary: number; ot_rate_per_hour: number | null };
export type AdvanceRow = { id: string; staff_id: string; adv_date: string; amount: number; note: string | null };

export async function getStaff(orgId: string, branchId: string | null, includeInactive = false): Promise<StaffRow[]> {
  const supabase = await createClient();
  let q = supabase.from("staff").select("id, name, designation, phone, joined_on, is_active, sort_order")
    .eq("org_id", orgId).order("sort_order").order("name");
  if (branchId) q = q.eq("branch_id", branchId);
  if (!includeInactive) q = q.eq("is_active", true);
  const { data } = await q;
  return (data ?? []) as StaffRow[];
}

export async function getDayAttendance(orgId: string, branchId: string | null, date: string): Promise<AttRow[]> {
  const supabase = await createClient();
  let q = supabase.from("staff_attendance").select("staff_id, att_date, status, in_time, out_time, ot_hours, note")
    .eq("org_id", orgId).eq("att_date", date);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data } = await q;
  return (data ?? []).map((r: any) => ({ ...r, ot_hours: Number(r.ot_hours) || 0 }));
}

export async function getPay(orgId: string, role: string | null | undefined): Promise<PayRow[]> {
  if (!canSeePay(role)) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("staff_pay").select("staff_id, monthly_salary, ot_rate_per_hour").eq("org_id", orgId);
  return (data ?? []).map((r: any) => ({ staff_id: r.staff_id, monthly_salary: Number(r.monthly_salary) || 0, ot_rate_per_hour: r.ot_rate_per_hour == null ? null : Number(r.ot_rate_per_hour) }));
}

export async function getMonthData(orgId: string, branchId: string | null, month: string, role: string | null | undefined) {
  const supabase = await createClient();
  const { from, to } = monthBounds(month);
  let aq = supabase.from("staff_attendance").select("staff_id, att_date, status, in_time, out_time, ot_hours, note")
    .eq("org_id", orgId).gte("att_date", from).lte("att_date", to).limit(20000);
  if (branchId) aq = aq.eq("branch_id", branchId);
  const pay = canSeePay(role);
  let vq = supabase.from("staff_advances").select("id, staff_id, adv_date, amount, note")
    .eq("org_id", orgId).gte("adv_date", from).lte("adv_date", to).order("adv_date", { ascending: false });
  if (branchId) vq = vq.eq("branch_id", branchId);
  const [staff, { data: att }, pays, adv] = await Promise.all([
    getStaff(orgId, branchId, true),
    aq,
    getPay(orgId, role),
    pay ? vq : Promise.resolve({ data: [] as any[] }),
  ]);
  return {
    staff,
    attendance: (att ?? []).map((r: any) => ({ ...r, ot_hours: Number(r.ot_hours) || 0 })) as AttRow[],
    pay: pays,
    advances: ((adv as any).data ?? []).map((r: any) => ({ ...r, amount: Number(r.amount) || 0 })) as AdvanceRow[],
  };
}
