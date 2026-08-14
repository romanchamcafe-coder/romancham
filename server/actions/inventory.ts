"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

type Payload = { ingredient_id: string; direction: "add" | "reduce"; qty: number; reason: string; note?: string };

export type RawInventoryRow = { name: string; target: string };

// Bulk stock-take for the CURRENT branch: for each item, set on-hand to the
// target "In Hand" value by posting the difference as a physical-count
// adjustment. Unknown names and invalid numbers are skipped; unchanged rows
// (target already equals current) are left alone.
export async function importInventoryCounts(
  rows: RawInventoryRow[],
): Promise<ActionState & { updated?: number; unchanged?: number; skipped?: number }> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId || !ctx.branch) return { error: "No active organization or branch" };
  const supabase = await createClient();
  const branchId = ctx.branch.id;

  const [{ data: ings }, { data: stock }] = await Promise.all([
    supabase.from("ingredients").select("id, name").eq("org_id", ctx.orgId).eq("is_active", true).in("material_type", ["purchase", "both"]),
    supabase.from("v_current_stock").select("ingredient_id, qty").eq("org_id", ctx.orgId).eq("branch_id", branchId),
  ]);
  const idByName = new Map((ings ?? []).map((i: any) => [String(i.name).trim().toLowerCase(), i.id]));
  const curById = new Map<string, number>();
  for (const s of stock ?? []) curById.set(s.ingredient_id, Number(s.qty) || 0);

  let updated = 0, unchanged = 0, skipped = 0;
  for (const r of rows) {
    const name = (r.name || "").trim();
    if (!name) continue;
    const id = idByName.get(name.toLowerCase());
    const target = Number(r.target);
    if (!id || !Number.isFinite(target) || target < 0) { skipped++; continue; }
    const cur = curById.get(id) ?? 0;
    const delta = Math.round((target - cur) * 10000) / 10000;
    if (Math.abs(delta) < 0.0001) { unchanged++; continue; }
    const { error } = await supabase.rpc("post_adjustment", {
      p: { org_id: ctx.orgId, branch_id: branchId, ingredient_id: id, qty: delta, reason: "count", note: "Bulk stock-take import" },
    });
    if (error) return { error: error.message };
    updated++;
  }

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { ok: true, updated, unchanged, skipped };
}

export async function createAdjustment(payload: Payload): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId || !ctx.branch) return { error: "No active organization or branch" };
  if (!payload.ingredient_id) return { error: "Please select an item" };
  const qty = Number(payload.qty);
  if (!qty || qty <= 0) return { error: "Enter a quantity greater than 0" };

  const signed = payload.direction === "reduce" ? -qty : qty;
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_adjustment", {
    p: {
      org_id: ctx.orgId,
      branch_id: ctx.branch.id,
      ingredient_id: payload.ingredient_id,
      qty: signed,
      reason: payload.reason || "count",
      note: payload.note || null,
    },
  });
  if (error) return { error: error.message };
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}
