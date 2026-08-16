"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/server/audit";
import type { ActionState } from "@/lib/types";

const base = "/production-consumption";
function revall() {
  for (const p of [base, `${base}/production`, `${base}/transfer`, `${base}/wastage`, `${base}/count`, `${base}/report`, "/dashboard", "/inventory"]) revalidatePath(p);
}

async function ctxOrErr() {
  const ctx = await getActiveContext();
  if (!ctx?.orgId || !ctx.branch) return { error: "No active organization or branch" as const };
  return { ctx };
}

// ---- Production Log ----
export type BatchInput = {
  sales_item_id: string; planned_qty: string; actual_yield: string;
  portions_per_unit?: string; expiry_date?: string; production_date?: string; note?: string;
};
export async function postProductionBatch(input: BatchInput): Promise<ActionState & { batchId?: string }> {
  const g = await ctxOrErr(); if ("error" in g) return { error: g.error };
  const { ctx } = g;
  if (!input.sales_item_id) return { error: "Select a finished good" };
  if (!Number(input.actual_yield) || Number(input.actual_yield) <= 0) return { error: "Enter an actual yield greater than 0" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("post_production_batch", {
    p: {
      org_id: ctx.orgId, branch_id: ctx.branch!.id, sales_item_id: input.sales_item_id,
      planned_qty: Number(input.planned_qty) || 0, actual_yield: Number(input.actual_yield) || 0,
      portions_per_unit: input.portions_per_unit ? Number(input.portions_per_unit) : null,
      expiry_date: (input.expiry_date || "").trim() || null,
      production_date: (input.production_date || "").trim() || null,
      note: (input.note || "").trim() || null,
    },
  });
  if (error) return { error: error.message };
  await logActivity({ action: "produce_batch", entity: "production_batch", entityId: (data as string) ?? null, newValue: input });
  revall();
  return { ok: true, batchId: data as string };
}

// ---- Stock Transfer ----
export type TransferInput = { sales_item_id: string; qty: string; transfer_date?: string; note?: string };
export async function postStockTransfer(input: TransferInput): Promise<ActionState> {
  const g = await ctxOrErr(); if ("error" in g) return { error: g.error };
  const { ctx } = g;
  if (!input.sales_item_id) return { error: "Select a product" };
  if (!Number(input.qty) || Number(input.qty) <= 0) return { error: "Enter a quantity greater than 0" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_stock_transfer", {
    p: { org_id: ctx.orgId, branch_id: ctx.branch!.id, sales_item_id: input.sales_item_id, qty: Number(input.qty), from_location: "store", to_location: "display", transfer_date: (input.transfer_date || "").trim() || null, note: (input.note || "").trim() || null },
  });
  if (error) return { error: error.message };
  await logActivity({ action: "stock_transfer", entity: "stock_transfer", newValue: input });
  revall();
  return { ok: true };
}

// ---- Wastage ----
export type WastageInput = { sales_item_id: string; qty: string; location: string; reason: string; wastage_date?: string; notes?: string };
export async function postWastage(input: WastageInput): Promise<ActionState> {
  const g = await ctxOrErr(); if ("error" in g) return { error: g.error };
  const { ctx } = g;
  if (!input.sales_item_id) return { error: "Select a product" };
  if (!input.reason) return { error: "Select a wastage reason" };
  if (!Number(input.qty) || Number(input.qty) <= 0) return { error: "Enter a quantity greater than 0" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_wastage_finished", {
    p: { org_id: ctx.orgId, branch_id: ctx.branch!.id, sales_item_id: input.sales_item_id, qty: Number(input.qty), location: input.location || "display", reason: input.reason, wastage_date: (input.wastage_date || "").trim() || null, notes: (input.notes || "").trim() || null },
  });
  if (error) return { error: error.message };
  await logActivity({ action: "wastage", entity: "wastage_entry", newValue: input });
  revall();
  return { ok: true };
}

// ---- Physical Count ----
export type CountInput = { sales_item_id: string; counted_qty: string; location: string; count_date?: string; explanation?: string };
export async function submitPhysicalCount(input: CountInput): Promise<ActionState & { result?: Record<string, unknown> }> {
  const g = await ctxOrErr(); if ("error" in g) return { error: g.error };
  const { ctx } = g;
  if (!input.sales_item_id) return { error: "Select a product" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_physical_count", {
    p: { org_id: ctx.orgId, branch_id: ctx.branch!.id, sales_item_id: input.sales_item_id, counted_qty: Number(input.counted_qty) || 0, location: input.location || "display", count_date: (input.count_date || "").trim() || null, explanation: (input.explanation || "").trim() || null },
  });
  if (error) return { error: error.message };
  await logActivity({ action: "physical_count", entity: "physical_count", newValue: input });
  revall();
  return { ok: true, result: data as Record<string, unknown> };
}

export async function approvePhysicalCount(countId: string): Promise<ActionState> {
  const g = await ctxOrErr(); if ("error" in g) return { error: g.error };
  const { ctx } = g;
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_physical_count", { p: { org_id: ctx.orgId, count_id: countId } });
  if (error) return { error: error.message };
  await logActivity({ action: "approve_count", entity: "physical_count", entityId: countId });
  revall();
  return { ok: true };
}

// ---- POS sync (finished-goods sale deduction from Display) ----
export async function syncFinishedSales(fromDate?: string, toDate?: string): Promise<ActionState & { result?: Record<string, unknown> }> {
  const g = await ctxOrErr(); if ("error" in g) return { error: g.error };
  const { ctx } = g;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sync_finished_sales", {
    p: { org_id: ctx.orgId, branch_id: ctx.branch!.id, from: fromDate || null, to: toDate || null },
  });
  if (error) return { error: error.message };
  await logActivity({ action: "sync_finished_sales", entity: "stock_ledger", newValue: data });
  revall();
  return { ok: true, result: data as Record<string, unknown> };
}

export async function resolveException(id: string): Promise<ActionState> {
  const g = await ctxOrErr(); if ("error" in g) return { error: g.error };
  const supabase = await createClient();
  const { error } = await supabase.from("pos_exception").update({ resolved_at: new Date().toISOString() }).eq("id", id).eq("org_id", g.ctx.orgId!);
  if (error) return { error: error.message };
  revall();
  return { ok: true };
}

// ---- Day close / reopen ----
export async function closeDay(businessDate: string): Promise<ActionState> {
  const g = await ctxOrErr(); if ("error" in g) return { error: g.error };
  const { ctx } = g;
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_consumption_period", { p: { org_id: ctx.orgId, branch_id: ctx.branch!.id, business_date: businessDate } });
  if (error) return { error: error.message };
  await logActivity({ action: "close_day", entity: "consumption_period", newValue: { businessDate } });
  revall();
  return { ok: true };
}
export async function reopenDay(businessDate: string): Promise<ActionState> {
  const g = await ctxOrErr(); if ("error" in g) return { error: g.error };
  const { ctx } = g;
  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_consumption_period", { p: { org_id: ctx.orgId, branch_id: ctx.branch!.id, business_date: businessDate } });
  if (error) return { error: error.message };
  await logActivity({ action: "reopen_day", entity: "consumption_period", newValue: { businessDate } });
  revall();
  return { ok: true };
}
