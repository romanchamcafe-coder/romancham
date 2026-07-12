"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

export type ProductionInput = {
  sales_item_id: string; qty: string; produced_on?: string; note?: string;
};

export async function postProduction(input: ProductionInput): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId || !ctx.branch) return { error: "No active organization or branch" };
  if (!input.sales_item_id) return { error: "Please select a finished good" };
  const qty = Number(input.qty);
  if (!qty || qty <= 0) return { error: "Enter a quantity greater than 0" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("post_production", {
    p: {
      org_id: ctx.orgId,
      branch_id: ctx.branch.id,
      sales_item_id: input.sales_item_id,
      qty,
      produced_on: (input.produced_on || "").trim() || null,
      note: (input.note || "").trim() || null,
    },
  });
  if (error) return { error: error.message };
  revalidatePath("/production");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}
