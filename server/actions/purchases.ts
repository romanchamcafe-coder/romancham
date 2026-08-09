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

function friendlyPurchaseError(msg: string): string {
  if (/stock_used/i.test(msg)) return "This bill's stock has already been used (e.g. in production), so it can't be changed. Adjust stock in the Inventory module instead.";
  if (/forbidden/i.test(msg)) return "You don't have permission to edit or delete purchases.";
  if (/not_found/i.test(msg)) return "That purchase no longer exists.";
  return msg;
}

export async function updatePurchase(id: string, payload: Payload): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (!id) return { error: "Missing purchase id" };
  const branchId = payload.branch_id || ctx.branch?.id;
  if (!branchId) return { error: "No branch (location) selected" };
  if (!payload.vendor_id) return { error: "Please select a vendor" };

  const items = (payload.items || []).filter((i) => i.ingredient_id && Number(i.qty) > 0);
  if (items.length === 0) return { error: "Add at least one product with a quantity" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("replace_purchase", {
    p_id: id,
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
  if (error) return { error: friendlyPurchaseError(error.message) };
  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deletePurchase(id: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (!id) return { error: "Missing purchase id" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_purchase", { p_id: id });
  if (error) return { error: friendlyPurchaseError(error.message) };
  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}
