"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

const FIELDS = ["sale_date","date_raw","location","invoice_no","payment_type","order_type","area",
  "item_name","price","qty","without_gst","discount","tax","final_total","status","table_no",
  "server_name","covers","variation","category","group_name","hsn","phone","customer_name","address",
  "gst","assign_to","non_taxable","cgst_rate","cgst_amount","sgst_rate","sgst_amount"];

export async function importPosSales(
  rows: Record<string, any>[], branchIdArg?: string, fileName?: string,
): Promise<ActionState & { imported?: number }> {
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

  // record import history (best-effort; never block the import result)
  try {
    await supabase.from("pos_imports").insert({
      org_id: ctx.orgId, branch_id: branchId, file_path: fileName ?? "sales.csv",
      status: "done", rows_total: rows.length, rows_ok: imported,
      mapping: { dates, batch },
    });
  } catch { /* ignore logging failures */ }

  // auto-backflush raw materials / finished stock for the imported dates
  if (dates.length) {
    const sorted = (dates as string[]).slice().sort();
    try {
      await supabase.rpc("sync_sales_consumption", {
        p: { org_id: ctx.orgId, branch_id: branchId, from: sorted[0], to: sorted[sorted.length - 1] },
      });
    } catch { /* best-effort; stock can be re-synced manually */ }
  }

  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { ok: true, imported };
}

const num = (v: any) => { const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isNaN(n) ? null : n; };

export type ManualSaleInput = {
  sale_date: string; item_name: string; category?: string; payment_type?: string;
  invoice_no?: string; location?: string; qty?: string; price?: string;
  without_gst?: string; tax?: string; final_total?: string;
};

export async function createManualSale(input: ManualSaleInput): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const branchId = ctx.branch?.id;
  if (!branchId) return { error: "No location/branch selected" };

  const item = (input.item_name || "").trim();
  if (!item) return { error: "Item name is required" };
  const date = (input.sale_date || "").trim() || new Date().toISOString().slice(0, 10);
  const total = num(input.final_total);
  if (total === null) return { error: "Enter a valid final total" };

  const supabase = await createClient();
  const { error } = await supabase.from("pos_sales").insert({
    org_id: ctx.orgId, branch_id: branchId, batch_id: crypto.randomUUID(),
    sale_date: date, date_raw: date,
    item_name: item,
    category: (input.category || "").trim() || null,
    payment_type: (input.payment_type || "").trim() || null,
    invoice_no: (input.invoice_no || "").trim() || null,
    location: (input.location || "").trim() || null,
    qty: num(input.qty), price: num(input.price),
    without_gst: num(input.without_gst), tax: num(input.tax), final_total: total,
    status: "Manual",
  });
  if (error) return { error: error.message };

  // auto-backflush raw materials / finished stock for this sale date
  try {
    await supabase.rpc("sync_sales_consumption", {
      p: { org_id: ctx.orgId, branch_id: branchId, from: date, to: date },
    });
  } catch { /* best-effort; stock can be re-synced manually */ }

  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function resyncSalesConsumption(from: string, to: string): Promise<ActionState & { matched?: number; unmatched?: string[] }> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const branchId = ctx.branch?.id;
  if (!branchId) return { error: "No location/branch selected" };
  const f = (from || "").trim(), t = (to || "").trim();
  if (!f || !t) return { error: "Pick a start and end date" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sync_sales_consumption", {
    p: { org_id: ctx.orgId, branch_id: branchId, from: f, to: t },
  });
  if (error) return { error: error.message };
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  const res = (data ?? {}) as { matched?: number; unmatched?: string[] };
  return { ok: true, matched: res.matched ?? 0, unmatched: res.unmatched ?? [] };
}

async function resyncDates(supabase: any, orgId: string, branchId: string, dates: (string | null | undefined)[]) {
  const uniq = [...new Set(dates.filter(Boolean))] as string[];
  for (const d of uniq) {
    try { await supabase.rpc("sync_sales_consumption", { p: { org_id: orgId, branch_id: branchId, from: d, to: d } }); } catch { /* best-effort */ }
  }
}

export async function updateSale(id: string, input: ManualSaleInput): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const branchId = ctx.branch?.id;
  if (!branchId) return { error: "No location/branch selected" };
  if (!id) return { error: "Missing row id" };

  const item = (input.item_name || "").trim();
  if (!item) return { error: "Item name is required" };
  const date = (input.sale_date || "").trim() || new Date().toISOString().slice(0, 10);
  const total = num(input.final_total);
  if (total === null) return { error: "Enter a valid final total" };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("pos_sales").select("sale_date").eq("id", id).eq("org_id", ctx.orgId).maybeSingle();

  const { error } = await supabase.from("pos_sales").update({
    sale_date: date, date_raw: date,
    item_name: item,
    category: (input.category || "").trim() || null,
    payment_type: (input.payment_type || "").trim() || null,
    invoice_no: (input.invoice_no || "").trim() || null,
    location: (input.location || "").trim() || null,
    qty: num(input.qty), price: num(input.price),
    without_gst: num(input.without_gst), tax: num(input.tax), final_total: total,
  }).eq("id", id).eq("org_id", ctx.orgId).eq("branch_id", branchId);
  if (error) return { error: error.message };

  await resyncDates(supabase, ctx.orgId, branchId, [date, existing?.sale_date]);
  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteSale(id: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const branchId = ctx.branch?.id;
  if (!branchId) return { error: "No location/branch selected" };
  if (!id) return { error: "Missing row id" };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("pos_sales").select("sale_date").eq("id", id).eq("org_id", ctx.orgId).maybeSingle();
  const { error } = await supabase.from("pos_sales").delete().eq("id", id).eq("org_id", ctx.orgId).eq("branch_id", branchId);
  if (error) return { error: error.message };

  await resyncDates(supabase, ctx.orgId, branchId, [existing?.sale_date]);
  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}
