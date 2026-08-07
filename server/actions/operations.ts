"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";
import { CHECKLIST_MAP } from "@/lib/ops/checklists";

type ChecklistItemState = { key: string; label: string; critical?: boolean; checked: boolean; value?: string };

export async function submitChecklist(
  type: string,
  items: ChecklistItemState[],
  notes?: string,
): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId || !ctx.branch) return { error: "No active organization or branch" };
  const def = CHECKLIST_MAP[type];
  if (!def) return { error: "Unknown checklist" };

  const total = items.length;
  const done = items.filter((i) => i.checked).length;
  const score = total ? Math.round((done / total) * 10000) / 100 : 0;

  const supabase = await createClient();
  // one run per checklist per branch per day — replace if re-submitted
  await supabase.from("ops_checklist_runs").delete()
    .eq("org_id", ctx.orgId).eq("branch_id", ctx.branch.id)
    .eq("checklist_type", type).eq("run_date", new Date().toISOString().slice(0, 10));

  const { error } = await supabase.from("ops_checklist_runs").insert({
    org_id: ctx.orgId, branch_id: ctx.branch.id, checklist_type: type,
    items, total, done, score, notes: (notes || "").trim() || null,
    performed_by: ctx.user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/operations");
  revalidatePath(`/operations/checklist/${type}`);
  revalidatePath("/dashboard");
  return { ok: true, message: `Saved — ${done}/${total} complete (${score}%)` };
}

const num = (v: any) => { const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; };

export type WastageInput = {
  ingredient_id?: string; item_name: string; qty: string; unit?: string;
  reason: string; cost: string; occurred_on?: string; note?: string;
};

export async function logWastage(input: WastageInput): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId || !ctx.branch) return { error: "No active organization or branch" };
  const item = (input.item_name || "").trim();
  if (!item) return { error: "Pick or type an item" };
  const qty = num(input.qty);
  if (qty <= 0) return { error: "Enter a quantity greater than 0" };
  if (!input.reason) return { error: "Choose a reason" };

  const supabase = await createClient();
  const { error } = await supabase.from("ops_wastage").insert({
    org_id: ctx.orgId, branch_id: ctx.branch.id,
    occurred_on: (input.occurred_on || "").trim() || new Date().toISOString().slice(0, 10),
    ingredient_id: input.ingredient_id || null,
    item_name: item, qty, unit: (input.unit || "").trim() || null,
    reason: input.reason, cost: num(input.cost),
    note: (input.note || "").trim() || null, logged_by: ctx.user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/operations");
  revalidatePath("/operations/wastage");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteWastage(id: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId || !id) return { error: "No active organization" };
  const supabase = await createClient();
  const { error } = await supabase.from("ops_wastage").delete().eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { error: error.message };
  revalidatePath("/operations/wastage");
  revalidatePath("/operations");
  return { ok: true };
}
