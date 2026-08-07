"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

const num = (v: any) => { const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; };

export type CashReconInput = { opening_float: string; cash_out: string; counted: string; note?: string };

export async function saveCashRecon(input: CashReconInput): Promise<ActionState & { variance?: number; expected?: number }> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId || !ctx.branch) return { error: "No active organization or branch" };

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // expected cash sales from the POS for today
  const { data: sales } = await supabase.from("pos_sales").select("final_total, payment_type")
    .eq("org_id", ctx.orgId).eq("branch_id", ctx.branch.id).eq("sale_date", today);
  const cashSales = (sales ?? []).filter((s: any) => /cash/i.test(s.payment_type || ""))
    .reduce((a: number, s: any) => a + (Number(s.final_total) || 0), 0);

  const opening = num(input.opening_float);
  const cashOut = num(input.cash_out);
  const counted = num(input.counted);
  const expected = Math.round((opening + cashSales - cashOut) * 100) / 100;
  const variance = Math.round((counted - expected) * 100) / 100;

  // one reconciliation per branch per day
  await supabase.from("ops_cash_recon").delete()
    .eq("org_id", ctx.orgId).eq("branch_id", ctx.branch.id).eq("recon_date", today);

  const { error } = await supabase.from("ops_cash_recon").insert({
    org_id: ctx.orgId, branch_id: ctx.branch.id, recon_date: today,
    opening_float: opening, cash_sales: Math.round(cashSales * 100) / 100, cash_out: cashOut,
    expected, counted, variance, note: (input.note || "").trim() || null, done_by: ctx.user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/operations/cash");
  revalidatePath("/operations");
  return { ok: true, variance, expected };
}
