"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { canSeePay, isStatus } from "@/lib/attendance";
import type { ActionState } from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

export type DayEntry = { staff_id: string; status: string; in_time?: string; out_time?: string; ot_hours?: string | number; note?: string };

export async function saveDayAttendance(date: string, entries: DayEntry[]): Promise<ActionState & { saved?: number }> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId || !ctx.branch) return { error: "No active organization or branch" };
  if (!DATE_RE.test(date)) return { error: "Pick a valid date" };
  const supabase = await createClient();

  const upserts = entries.filter((e) => isStatus(e.status)).map((e) => ({
    org_id: ctx.orgId, branch_id: ctx.branch!.id, staff_id: e.staff_id, att_date: date, status: e.status,
    in_time: e.in_time && TIME_RE.test(e.in_time) ? e.in_time : null,
    out_time: e.out_time && TIME_RE.test(e.out_time) ? e.out_time : null,
    ot_hours: Math.max(0, Math.min(24, Number(e.ot_hours) || 0)),
    note: (e.note || "").trim() || null,
    marked_by: ctx.user.id, updated_at: new Date().toISOString(),
  }));
  const cleared = entries.filter((e) => !e.status).map((e) => e.staff_id);

  if (upserts.length) {
    const { error } = await supabase.from("staff_attendance").upsert(upserts, { onConflict: "staff_id,att_date" });
    if (error) return { error: error.message };
  }
  if (cleared.length) {
    await supabase.from("staff_attendance").delete().eq("org_id", ctx.orgId).eq("att_date", date).in("staff_id", cleared);
  }
  revalidatePath("/attendance");
  return { ok: true, saved: upserts.length };
}

export type StaffInput = {
  id?: string; name: string; designation?: string; phone?: string; joined_on?: string; is_active?: boolean;
  monthly_salary?: string | number; ot_rate_per_hour?: string | number | null;
};

export async function saveStaff(input: StaffInput): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId || !ctx.branch) return { error: "No active organization or branch" };
  const name = (input.name || "").trim();
  if (!name) return { error: "Name is required" };
  const supabase = await createClient();
  const row = {
    name, designation: (input.designation || "").trim() || null, phone: (input.phone || "").trim() || null,
    joined_on: input.joined_on && DATE_RE.test(input.joined_on) ? input.joined_on : null,
    is_active: input.is_active !== false,
  };
  let id = input.id;
  if (id) {
    const { data, error } = await supabase.from("staff").update(row).eq("id", id).eq("org_id", ctx.orgId).select("id");
    if (error) return { error: error.message };
    if (!data?.length) return { error: "Couldn't update this staff member" };
  } else {
    const { count } = await supabase.from("staff").select("id", { count: "exact", head: true }).eq("org_id", ctx.orgId);
    const { data, error } = await supabase.from("staff").insert({ ...row, org_id: ctx.orgId, branch_id: ctx.branch.id, sort_order: (count ?? 0) + 1 }).select("id").single();
    if (error) return { error: error.message };
    id = data.id;
  }
  // Salary fields: only pay-visible roles (also enforced by RLS).
  if (canSeePay(ctx.role) && (input.monthly_salary !== undefined || input.ot_rate_per_hour !== undefined)) {
    const ot = input.ot_rate_per_hour === "" || input.ot_rate_per_hour == null ? null : Number(input.ot_rate_per_hour);
    const { error } = await supabase.from("staff_pay").upsert({
      staff_id: id, org_id: ctx.orgId, monthly_salary: Math.max(0, Number(input.monthly_salary) || 0),
      ot_rate_per_hour: ot != null && ot >= 0 ? ot : null, updated_at: new Date().toISOString(),
    }, { onConflict: "staff_id" });
    if (error) return { error: error.message };
  }
  revalidatePath("/attendance");
  return { ok: true };
}

export async function addAdvance(input: { staff_id: string; adv_date: string; amount: string | number; note?: string }): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId || !ctx.branch) return { error: "No active organization or branch" };
  if (!canSeePay(ctx.role)) return { error: "Only the owner or a manager can record advances" };
  const amount = Number(input.amount);
  if (!input.staff_id) return { error: "Select a staff member" };
  if (!(amount > 0)) return { error: "Enter an amount greater than 0" };
  if (!DATE_RE.test(input.adv_date)) return { error: "Pick a valid date" };
  const supabase = await createClient();
  const { error } = await supabase.from("staff_advances").insert({
    org_id: ctx.orgId, branch_id: ctx.branch.id, staff_id: input.staff_id, adv_date: input.adv_date,
    amount, note: (input.note || "").trim() || null, created_by: ctx.user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/attendance");
  return { ok: true };
}

export async function deleteAdvance(id: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (!canSeePay(ctx.role)) return { error: "Not allowed" };
  const supabase = await createClient();
  const { error } = await supabase.from("staff_advances").delete().eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { error: error.message };
  revalidatePath("/attendance");
  return { ok: true };
}
