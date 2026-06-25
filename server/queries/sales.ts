import { createClient } from "@/lib/supabase/server";

export async function getSalesRegister(orgId: string, branchId: string | null, limit = 500) {
  const supabase = await createClient();
  let q = supabase.from("pos_sales").select("*").eq("org_id", orgId)
    .order("sale_date", { ascending: false, nullsFirst: false })
    .order("uploaded_at", { ascending: false })
    .limit(limit);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data } = await q;
  return data ?? [];
}
