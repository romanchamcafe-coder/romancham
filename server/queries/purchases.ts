import { createClient } from "@/lib/supabase/server";

export async function getPurchases(orgId: string, branchId: string | null) {
  const supabase = await createClient();
  let q = supabase
    .from("purchases")
    .select("id, bill_no, bill_date, subtotal, cgst, sgst, igst, total, payment_status, vendors(name)")
    .eq("org_id", orgId)
    .order("bill_date", { ascending: false });
  if (branchId) q = q.eq("branch_id", branchId);
  const { data } = await q;
  return data ?? [];
}

export async function getPurchaseFormData(orgId: string) {
  const supabase = await createClient();
  const [{ data: vendors }, { data: ingredients }] = await Promise.all([
    supabase.from("vendors").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name"),
    supabase.from("ingredients").select("id, name, default_gst_rate").eq("org_id", orgId).eq("is_active", true).order("name"),
  ]);
  return { vendors: vendors ?? [], ingredients: ingredients ?? [] };
}
