import { createClient } from "@/lib/supabase/server";

export async function getExpenses(orgId: string, branchId: string | null) {
  const supabase = await createClient();
  let q = supabase.from("expenses")
    .select("id, expense_date, amount, gst_amount, vendor_name, payment_method, note, categories(name)")
    .eq("org_id", orgId).order("expense_date", { ascending: false }).limit(300);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data } = await q;
  return data ?? [];
}

export async function getExpenseCategories(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, name")
    .eq("org_id", orgId).eq("type", "expense").eq("is_active", true).order("name");
  return data ?? [];
}
