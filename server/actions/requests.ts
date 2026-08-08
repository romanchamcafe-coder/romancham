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

const APPROVER_ROLES = ["owner", "admin", "manager", "branch_manager"];

export async function decideIndent(id: string, status: "approved" | "fulfilled" | "rejected"): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (!APPROVER_ROLES.includes(ctx.role ?? "")) return { error: "Only a manager can approve or reject" };
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

/**
 * Phase 12 — Low-stock automation. Scan current stock, and for every ingredient
 * at/below its reorder level create DRAFT purchase requests grouped by the
 * suggested (primary) vendor, with a suggested quantity (top up to max level).
 */
export async function draftLowStockPurchaseRequests(): Promise<ActionState & { created?: number; items?: number }> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId || !ctx.branch) return { error: "No active organization or branch" };
  const supabase = await createClient();
  const branchId = ctx.branch.id;

  const [{ data: ings }, { data: stock }, { data: vi }, { data: units }] = await Promise.all([
    supabase.from("ingredients").select("id, name, reorder_level, max_level, base_unit_id")
      .eq("org_id", ctx.orgId).eq("is_active", true).in("material_type", ["purchase", "both"]),
    supabase.from("v_current_stock").select("ingredient_id, qty").eq("org_id", ctx.orgId).eq("branch_id", branchId),
    supabase.from("vendor_ingredients").select("ingredient_id, vendor_id, tier"),
    supabase.from("units").select("id, abbr").eq("org_id", ctx.orgId),
  ]);

  const qtyMap = new Map<string, number>();
  for (const s of stock ?? []) qtyMap.set(s.ingredient_id, Number(s.qty) || 0);
  const uni = new Map((units ?? []).map((u: any) => [u.id, u.abbr]));
  // preferred vendor per ingredient: primary tier first, else any
  const vendorFor = new Map<string, string>();
  for (const r of vi ?? []) {
    if (!vendorFor.has(r.ingredient_id) || r.tier === "primary") vendorFor.set(r.ingredient_id, r.vendor_id);
  }

  // existing pending PR item ids — don't double-draft
  const { data: pending } = await supabase.from("ops_purchase_requests")
    .select("items").eq("org_id", ctx.orgId).eq("branch_id", branchId).eq("status", "pending");
  const alreadyRequested = new Set<string>();
  for (const p of pending ?? []) for (const it of (p.items as any[]) ?? []) if (it?.ingredient_id) alreadyRequested.add(it.ingredient_id);

  type Item = { ingredient_id: string; name: string; unit: string; qty: number };
  const byVendor = new Map<string, Item[]>();
  for (const i of ings ?? []) {
    const reorder = Number(i.reorder_level) || 0;
    if (reorder <= 0) continue;
    const qty = qtyMap.get(i.id) ?? 0;
    if (qty > reorder) continue;
    if (alreadyRequested.has(i.id)) continue;
    const max = Number(i.max_level) || 0;
    const suggest = Math.max(1, Math.ceil(max > qty ? max - qty : reorder * 2 - qty));
    const vendor = vendorFor.get(i.id) ?? "none";
    const item: Item = { ingredient_id: i.id, name: i.name, unit: i.base_unit_id ? uni.get(i.base_unit_id) ?? "" : "", qty: suggest };
    (byVendor.get(vendor) ?? byVendor.set(vendor, []).get(vendor)!).push(item);
  }

  if (byVendor.size === 0) return { error: "No low-stock items need a purchase request right now." };

  let created = 0, itemCount = 0;
  for (const [vendor, items] of byVendor) {
    const { error } = await supabase.from("ops_purchase_requests").insert({
      org_id: ctx.orgId, branch_id: branchId, status: "pending",
      vendor_id: vendor === "none" ? null : vendor, items,
      note: "Auto-drafted from low stock", requested_by: ctx.user.id,
    });
    if (!error) { created += 1; itemCount += items.length; }
  }
  revalidatePath("/operations/purchase-requests"); revalidatePath("/operations");
  return { ok: true, created, items: itemCount };
}

export async function decidePurchaseRequest(id: string, status: "approved" | "ordered" | "received" | "rejected"): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const gated = status === "approved" || status === "rejected";
  if (gated && !APPROVER_ROLES.includes(ctx.role ?? "")) return { error: "Only a manager can approve or reject" };
  const supabase = await createClient();
  const patch: Record<string, any> = { status };
  if (gated) { patch.decided_by = ctx.user.id; patch.decided_at = new Date().toISOString(); }
  const { error } = await supabase.from("ops_purchase_requests").update(patch).eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { error: error.message };
  revalidatePath("/operations/purchase-requests"); revalidatePath("/operations");
  return { ok: true };
}
