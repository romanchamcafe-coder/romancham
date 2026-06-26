"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

const orNull = (v: FormDataEntryValue | null) => { const s = String(v ?? "").trim(); return s === "" ? null : s; };

export async function createExpense(_: ActionState | null, formData: FormData): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId || !ctx.branch) return { error: "No active organization or branch" };
  const amount = Number(formData.get("amount"));
  if (!amount || amount <= 0) return { error: "Enter an amount" };

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    org_id: ctx.orgId, branch_id: ctx.branch.id,
    category_id: orNull(formData.get("category_id")),
    expense_date: orNull(formData.get("expense_date")) || new Date().toISOString().slice(0, 10),
    amount, gst_amount: Number(formData.get("gst_amount")) || 0,
    vendor_name: orNull(formData.get("vendor_name")),
    payment_method: orNull(formData.get("payment_method")),
    note: orNull(formData.get("note")),
  });
  if (error) return { error: error.message };
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { ok: true };
}
