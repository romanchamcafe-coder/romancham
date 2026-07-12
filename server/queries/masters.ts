import { createClient } from "@/lib/supabase/server";

export async function getMaterialFormData(orgId: string) {
  const supabase = await createClient();
  const [{ data: categories }, { data: units }, { data: vendors }] = await Promise.all([
    supabase.from("categories").select("id, name").eq("org_id", orgId).eq("type", "ingredient").eq("is_active", true).order("name"),
    supabase.from("units").select("id, name, abbr").eq("org_id", orgId).eq("is_active", true).order("name"),
    supabase.from("vendors").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name"),
  ]);
  return { categories: categories ?? [], units: units ?? [], vendors: vendors ?? [] };
}

export async function getMaterials(orgId: string, type?: string) {
  const supabase = await createClient();
  let mq = supabase.from("ingredients")
    .select("id, name, material_type, category_id, base_unit_id, default_vendor_id, default_gst_rate, reorder_level, hsn_code")
    .eq("org_id", orgId).order("name");
  if (type === "purchase") mq = mq.in("material_type", ["purchase", "both"]);
  else if (type === "sales") mq = mq.in("material_type", ["sales", "both"]);

  const [{ data: items }, { data: categories }, { data: units }, { data: vendors }] = await Promise.all([
    mq,
    supabase.from("categories").select("id, name").eq("org_id", orgId),
    supabase.from("units").select("id, abbr").eq("org_id", orgId),
    supabase.from("vendors").select("id, name").eq("org_id", orgId),
  ]);
  const cat = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const uni = new Map((units ?? []).map((u) => [u.id, u.abbr]));
  const ven = new Map((vendors ?? []).map((v) => [v.id, v.name]));
  return (items ?? []).map((i: any) => ({
    ...i,
    category_name: i.category_id ? cat.get(i.category_id) ?? "—" : "—",
    uom: i.base_unit_id ? uni.get(i.base_unit_id) ?? "—" : "—",
    vendor_name: i.default_vendor_id ? ven.get(i.default_vendor_id) ?? "—" : "—",
  }));
}
