import { createClient } from "@/lib/supabase/server";

export async function getPurchaseRegister(orgId: string, branchId: string | null) {
  const supabase = await createClient();
  let q = supabase
    .from("purchase_items")
    .select(`
      id, qty, rate, uom, category, line_total,
      ingredients(name),
      purchases!inner(bill_no, bill_date, payment_mode, org_id, branch_id, vendors(name), branches(name))
    `)
    .eq("purchases.org_id", orgId);
  if (branchId) q = q.eq("purchases.branch_id", branchId);
  const { data } = await q;
  return (data ?? []).slice().sort((a: any, b: any) => {
    const da = a.purchases?.bill_date ?? "";
    const db = b.purchases?.bill_date ?? "";
    return da < db ? 1 : da > db ? -1 : 0;
  });
}

export async function getPurchaseFormData(orgId: string) {
  const supabase = await createClient();
  const [{ data: vendors }, { data: ingredients }, { data: branches }] = await Promise.all([
    supabase.from("vendors").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name"),
    supabase.from("ingredients").select("id, name, default_gst_rate").eq("org_id", orgId).eq("is_active", true).order("name"),
    supabase.from("branches").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name"),
  ]);
  return { vendors: vendors ?? [], ingredients: ingredients ?? [], branches: branches ?? [] };
}
