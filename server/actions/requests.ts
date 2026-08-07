"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

const num = (v: any) => { const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; };

// each row from the client: { ingredient_id, qty }
type Row = { ingredient_id: string; qty: string | number };

async function resolveItems(orgId: string, rows: Row[]) {
  const supabase = await createClient();
  const ids = rows.map((r) => r.ingredient_id).filter(Boolean);
  const { data: ings } = await supabase.from("ingredients")
    .select("id, name, base_unit_id").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const { data: units } = await supabase.from("units").select("id, abbr").eq("org_id", orgId);
  const uni = new Map((units ?? []).map((u: any) => [u.id, u.abbr]));
  const meta = new Map((ings ?? []).map((i: any) => [i.id, { name: i.name, unit: i.base_unit_id ? uni.get(i.base_unit_id) ?? "" : "" }]));
  return rows
    .map((r) => {
      const m = meta.get(r.ingredient_id);
      const qty = num(r.qty);
      return m && qty > 0 ? { ingredient_id: r.ingredient_id, name: m.name, unit: m.unit, qty } : null;
    })
    .filter(Boolean) as { ingredient_id: string; name: string; unit: string; qty: number }[];
}

export async function createIndent(rows: Row[], note?: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId || !ctx.branch) return { error: "No active organization or branch" };
  const items = await resolveItems(ctx.orgId, rows);
  if (items.length === 0) return { error: "Add at least one item with a quantity" };
  const supabase = await createClient();
  const { error } = await supabase.from("ops_indents").insert({
    org_id: ctx.orgId, branch_id: ctx.branch.id, status: "pending",
    items, note: (note || "").trim() || null, requested_by: ctx.user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/operations/indents"); revalidatePath("/operations");
  return { ok: true };
}

export async function decideIndent(id: string, status: "approved" | "fulfilled" | "rejected"): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (ctx.role !== "owner" && ctx.role !== "manager") return { error: "Only a manager can approve or reject" };
  const supabase = await createClient();
  const { error } = await supabase.from("ops_indents")
    .update({ status, decided_by: ctx.user.id, decided_at: new Date().toISOString() })
    .eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { error: error.message };
  revalidatePath("/operations/indents"); revalidatePath("/operations");
  return { ok: true };
}

export async function createPurchaseRequest(vendorId: string | undefined, rows: Row[], note?: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId || !ctx.branch) return { error: "No active organization or branch" };
  const items = await resolveItems(ctx.orgId, rows);
  if (items.length === 0) return { error: "Add at least one item with a quantity" };
  const supabase = await createClient();
  const { error } = await supabase.from("ops_purchase_requests").insert({
    org_id: ctx.orgId, branch_id: ctx.branch.id, status: "pending",
    vendor_id: vendorId || null, items, note: (note || "").trim() || null, requested_by: ctx.user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/operations/purchase-requests"); revalidatePath("/operations");
  return { ok: true };
}

export async function decidePurchaseRequest(id: string, status: "approved" | "ordered" | "received" | "rejected"): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const gated = status === "approved" || status === "rejected";
  if (gated && ctx.role !== "owner" && ctx.role !== "manager") return { error: "Only a manager can approve or reject" };
  const supabase = await createClient();
  const patch: Record<string, any> = { status };
  if (gated) { patch.decided_by = ctx.user.id; patch.decided_at = new Date().toISOString(); }
  const { error } = await supabase.from("ops_purchase_requests").update(patch).eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { error: error.message };
  revalidatePath("/operations/purchase-requests"); revalidatePath("/operations");
  return { ok: true };
}
