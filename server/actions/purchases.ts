"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

type Line = { ingredient_id: string; qty: number; rate: number; gst_rate: number };
type Payload = {
  vendor_id: string;
  bill_no?: string;
  bill_date?: string;
  due_date?: string;
  payment_status?: "unpaid" | "partial" | "paid";
  items: Line[];
};

export async function createPurchase(payload: Payload): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId || !ctx.branch) return { error: "No active organization or branch" };
  if (!payload.vendor_id) return { error: "Please select a vendor" };

  const items = (payload.items || []).filter((i) => i.ingredient_id && Number(i.qty) > 0);
  if (items.length === 0) return { error: "Add at least one item with a quantity" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("post_purchase", {
    p: {
      org_id: ctx.orgId,
      branch_id: ctx.branch.id,
      vendor_id: payload.vendor_id,
      bill_no: payload.bill_no || null,
      bill_date: payload.bill_date || null,
      due_date: payload.due_date || null,
      payment_status: payload.payment_status || "unpaid",
      items: items.map((i) => ({
        ingredient_id: i.ingredient_id,
        qty: Number(i.qty),
        unit_id: null,
        rate: Number(i.rate),
        gst_rate: Number(i.gst_rate) || 0,
      })),
    },
  });
  if (error) return { error: error.message };
  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}
