"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

export type PurchaseLine = {
  ingredient_id: string;
  category?: string;
  purchase_uom?: string;       // packaging label (Packet, Bottle, …)
  pack_qty: number;            // number of packages
  pack_size: number;           // qty inside one package (value)
  pack_size_unit_id?: string;  // unit of the pack size (g, kg, ml, …)
  unit_price: number;          // price per package
  gst_rate?: number;           // GST %
  uom?: string;                // base unit abbr (display hint)
};
export type Payload = {
  vendor_id: string;
  branch_id?: string;
  payment_mode?: "petty_cash" | "credit";
  bill_no?: string;
  bill_date?: string;
  items: PurchaseLine[];
};

function cleanItems(items: PurchaseLine[]): PurchaseLine[] {
  return (items || []).filter((i) => i.ingredient_id && Number(i.pack_qty) > 0);
}

function validate(items: PurchaseLine[]): string | null {
  if (items.length === 0) return "Add at least one product with a purchase quantity";
  for (const i of items) {
    if (!(Number(i.pack_qty) > 0)) return "Purchase quantity must be greater than 0";
    if (!(Number(i.pack_size) > 0)) return "Pack size must be greater than 0";
    if (Number(i.unit_price) < 0 || Number.isNaN(Number(i.unit_price))) return "Unit price must be 0 or more";
  }
  return null;
}

function toRpcItems(items: PurchaseLine[]) {
  return items.map((i) => ({
    ingredient_id: i.ingredient_id,
    category: i.category || null,
    purchase_uom: i.purchase_uom || null,
    pack_qty: Number(i.pack_qty),
    pack_size: Number(i.pack_size),
    pack_size_unit_id: i.pack_size_unit_id || null,
    unit_price: Number(i.unit_price),
    gst_rate: i.gst_rate != null && !Number.isNaN(Number(i.gst_rate)) ? Number(i.gst_rate) : 0,
    uom: i.uom || null,
  }));
}

function friendlyPurchaseError(msg: string): string {
  if (/stock_used/i.test(msg)) return "This bill's stock has already been used (e.g. in production), so it can't be changed. Adjust stock in the Inventory module instead.";
  if (/forbidden/i.test(msg)) return "You don't have permission to edit or delete purchases.";
  if (/not_found/i.test(msg)) return "That purchase no longer exists.";
  return msg;
}

export async function createPurchase(payload: Payload): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const branchId = payload.branch_id || ctx.branch?.id;
  if (!branchId) return { error: "No branch (location) selected" };
  if (!payload.vendor_id) return { error: "Please select a vendor" };

  const items = cleanItems(payload.items);
  const err = validate(items);
  if (err) return { error: err };

  const supabase = await createClient();
  const { error } = await supabase.rpc("post_purchase", {
    p: {
      org_id: ctx.orgId,
      branch_id: branchId,
      vendor_id: payload.vendor_id,
      payment_mode: payload.payment_mode || "credit",
      bill_no: payload.bill_no || null,
      bill_date: payload.bill_date || null,
      items: toRpcItems(items),
    },
  });
  if (error) return { error: friendlyPurchaseError(error.message) };
  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updatePurchase(id: string, payload: Payload): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (!id) return { error: "Missing purchase id" };
  const branchId = payload.branch_id || ctx.branch?.id;
  if (!branchId) return { error: "No branch (location) selected" };
  if (!payload.vendor_id) return { error: "Please select a vendor" };

  const items = cleanItems(payload.items);
  const err = validate(items);
  if (err) return { error: err };

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
      items: toRpcItems(items),
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
