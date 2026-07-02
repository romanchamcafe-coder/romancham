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
  const [{ data: vendors }, { data: branches }, { data: ings }, { data: cats }, { data: units }, { data: vi }] =
    await Promise.all([
      supabase.from("vendors").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name"),
      supabase.from("branches").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name"),
      supabase.from("ingredients").select("id, name, category_id, base_unit_id, default_gst_rate, default_vendor_id")
        .eq("org_id", orgId).eq("is_active", true).in("material_type", ["purchase", "both"]).order("name"),
      supabase.from("categories").select("id, name").eq("org_id", orgId).eq("is_active", true),
      supabase.from("units").select("id, abbr").eq("org_id", orgId).eq("is_active", true),
      supabase.from("vendor_ingredients").select("ingredient_id, vendor_id, last_price"),
    ]);

  const cat = new Map((cats ?? []).map((c) => [c.id, c.name]));
  const uni = new Map((units ?? []).map((u) => [u.id, u.abbr]));
  // last price per ingredient, preferring the material's default vendor
  const priceByIng = new Map<string, number>();
  for (const row of vi ?? []) {
    if (row.last_price == null) continue;
    if (!priceByIng.has(row.ingredient_id)) priceByIng.set(row.ingredient_id, Number(row.last_price));
  }
  for (const i of ings ?? []) {
    if (i.default_vendor_id) {
      const pref = (vi ?? []).find((r) => r.ingredient_id === i.id && r.vendor_id === i.default_vendor_id);
      if (pref?.last_price != null) priceByIng.set(i.id, Number(pref.last_price));
    }
  }

  const ingredients = (ings ?? []).map((i: any) => ({
    id: i.id,
    name: i.name,
    default_gst_rate: Number(i.default_gst_rate) || 0,
    default_vendor_id: i.default_vendor_id ?? "",
    category_name: i.category_id ? cat.get(i.category_id) ?? "" : "",
    uom: i.base_unit_id ? uni.get(i.base_unit_id) ?? "" : "",
    last_price: priceByIng.get(i.id) ?? 0,
  }));

  return { vendors: vendors ?? [], branches: branches ?? [], ingredients };
}

export async function getPurchaseReadiness(orgId: string) {
  const supabase = await createClient();
  const [ing, ven] = await Promise.all([
    supabase.from("ingredients").select("id", { count: "exact", head: true })
      .eq("org_id", orgId).eq("is_active", true).in("material_type", ["purchase", "both"]),
    supabase.from("vendors").select("id", { count: "exact", head: true })
      .eq("org_id", orgId).eq("is_active", true),
  ]);
  return { ingredients: ing.count ?? 0, vendors: ven.count ?? 0 };
}
