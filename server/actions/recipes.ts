"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

type Comp = { component_id: string; qty: number };

export async function saveRecipe(salesItemId: string, components: Comp[]): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (!salesItemId) return { error: "Select a sales item" };

  const rows = (components || [])
    .filter((c) => c.component_id && Number(c.qty) > 0)
    .map((c) => ({ org_id: ctx.orgId, sales_item_id: salesItemId, component_id: c.component_id, qty: Number(c.qty) }));

  const supabase = await createClient();
  await supabase.from("item_recipe").delete().eq("org_id", ctx.orgId).eq("sales_item_id", salesItemId);
  if (rows.length) {
    const { error } = await supabase.from("item_recipe").insert(rows);
    if (error) return { error: error.message };
  }
  revalidatePath("/recipes");
  revalidatePath("/dashboard");
  return { ok: true };
}
