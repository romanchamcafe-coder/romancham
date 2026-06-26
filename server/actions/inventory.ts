"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

type Payload = { ingredient_id: string; direction: "add" | "reduce"; qty: number; reason: string; note?: string };

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
