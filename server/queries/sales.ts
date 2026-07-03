import { createClient } from "@/lib/supabase/server";

export type SalesFilters = {
  search?: string; from?: string; to?: string; payment?: string; category?: string;
};

function sanitize(s: string) {
  return s.replace(/[,%()]/g, " ").trim();
}

export async function getSalesRegister(
  orgId: string, branchId: string | null,
  filters: SalesFilters = {}, page = 1, pageSize = 50,
) {
  const supabase = await createClient();
  let q = supabase.from("pos_sales").select("*", { count: "exact" }).eq("org_id", orgId);
  if (branchId) q = q.eq("branch_id", branchId);
  if (filters.from) q = q.gte("sale_date", filters.from);
  if (filters.to) q = q.lte("sale_date", filters.to);
  if (filters.payment) q = q.eq("payment_type", filters.payment);
  if (filters.category) q = q.eq("category", filters.category);
  if (filters.search) {
    const s = sanitize(filters.search);
    if (s) q = q.or(`item_name.ilike.%${s}%,invoice_no.ilike.%${s}%,customer_name.ilike.%${s}%`);
  }
  q = q.order("sale_date", { ascending: false, nullsFirst: false }).order("uploaded_at", { ascending: false });
  const start = Math.max(0, (page - 1) * pageSize);
  q = q.range(start, start + pageSize - 1);
  const { data, count } = await q;
  return { rows: data ?? [], total: count ?? 0 };
}

export async function getSalesMeta(orgId: string, branchId: string | null) {
  const supabase = await createClient();
  let q = supabase.from("pos_sales").select("payment_type, category").eq("org_id", orgId).limit(1000);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data } = await q;
  const payments = [...new Set((data ?? []).map((r: any) => r.payment_type).filter(Boolean))].sort();
  const categories = [...new Set((data ?? []).map((r: any) => r.category).filter(Boolean))].sort();
  return { payments, categories };
}

export async function getSalesImports(orgId: string, branchId: string | null, limit = 8) {
  const supabase = await createClient();
  let q = supabase.from("pos_imports")
    .select("id, file_path, status, rows_total, rows_ok, mapping, created_at")
    .eq("org_id", orgId).order("created_at", { ascending: false }).limit(limit);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data } = await q;
  return data ?? [];
}
