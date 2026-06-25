"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

type Line = { ingredient_id: string; category?: string; uom?: string; qty: number; rate: number; with_gst?: number };
type Payload = {
  vendor_id: string;
  branch_id?: string;
  payment_mode?: "petty_cash" | "credit";
  bill_no?: string;
  bill_date?: string;
  items: Line[];
};

export async function createPurchase(payload: Payload): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const branchId = payload.branch_id || ctx.branch?.id;
  if (!branchId) return { error: "No branch (location) selected" };
  if (!payload.vendor_id) return { error: "Please select a vendor" };

  const items = (payload.items || []).filter((i) => i.ingredient_id && Number(i.qty) > 0);
  if (items.length === 0) return { error: "Add at least one product with a quantity" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("post_purchase", {
    p: {
      org_id: ctx.orgId,
      branch_id: branchId,
      vendor_id: payload.vendor_id,
      payment_mode: payload.payment_mode || "credit",
      bill_no: payload.bill_no || null,
      bill_date: payload.bill_date || null,
      items: items.map((i) => ({
        ingredient_id: i.ingredient_id,
        category: i.category || null,
        uom: i.uom || null,
        qty: Number(i.qty),
        rate: Number(i.rate),
        with_gst: i.with_gst != null && !Number.isNaN(Number(i.with_gst)) ? Number(i.with_gst) : null,
      })),
    },
  });
  if (error) return { error: error.message };
  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}
