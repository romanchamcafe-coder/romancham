"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

const FIELDS = ["sale_date","date_raw","location","invoice_no","payment_type","order_type","area",
  "item_name","price","qty","without_gst","discount","tax","final_total","status","table_no",
  "server_name","covers","variation","category","group_name","hsn","phone","customer_name","address",
  "gst","assign_to","non_taxable","cgst_rate","cgst_amount","sgst_rate","sgst_amount"];

export async function importPosSales(rows: Record<string, any>[], branchIdArg?: string): Promise<ActionState & { imported?: number }> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const branchId = branchIdArg || ctx.branch?.id;
  if (!branchId) return { error: "No location/branch selected" };
  if (!rows?.length) return { error: "No rows found in the file" };

  const supabase = await createClient();
  const batch = crypto.randomUUID();
  const clean = rows.map((r) => {
    const o: Record<string, any> = { org_id: ctx.orgId, branch_id: branchId, batch_id: batch };
    for (const f of FIELDS) o[f] = r[f] ?? null;
    return o;
  });

  // replace-by-date so re-uploading a day's file doesn't create duplicates
  const dates = [...new Set(clean.map((r) => r.sale_date).filter(Boolean))];
  if (dates.length) {
    await supabase.from("pos_sales").delete().eq("branch_id", branchId).in("sale_date", dates as string[]);
  }

  let imported = 0;
  for (let i = 0; i < clean.length; i += 500) {
    const chunk = clean.slice(i, i + 500);
    const { error } = await supabase.from("pos_sales").insert(chunk);
    if (error) return { error: error.message, imported };
    imported += chunk.length;
  }
  revalidatePath("/sales");
  revalidatePath("/dashboard");
  return { ok: true, imported };
}
