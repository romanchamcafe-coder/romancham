import { createClient } from "@/lib/supabase/server";

export type PurchaseSortKey =
  | "payment_mode" | "vendor" | "location" | "bill_no" | "bill_date"
  | "category" | "product" | "uom" | "qty" | "rate" | "without_gst" | "with_gst";

export type PurchaseFilters = {
  search?: string; vendor?: string; from?: string; to?: string; invoice?: string; category?: string;
  sort?: PurchaseSortKey; dir?: "asc" | "desc";
};

export type PurchaseRow = {
  id: string; payment_mode: string | null; vendor: string; location: string;
  bill_no: string; bill_date: string; category: string; product: string;
  uom: string; qty: number; rate: number; without_gst: number; with_gst: number;
};

export async function getPurchaseRegister(
  orgId: string, branchId: string | null,
  filters: PurchaseFilters = {}, page = 1, pageSize = 50,
): Promise<{ rows: PurchaseRow[]; total: number }> {
  const supabase = await createClient();
  let q = supabase
    .from("purchase_items")
    .select(`
      id, qty, rate, uom, category, line_total,
      ingredients(name),
      purchases!inner(bill_no, bill_date, payment_mode, org_id, branch_id, vendors(name), branches(name))
    `)
    .eq("purchases.org_id", orgId)
    .limit(5000);
  if (branchId) q = q.eq("purchases.branch_id", branchId);
  if (filters.from) q = q.gte("purchases.bill_date", filters.from);
  if (filters.to) q = q.lte("purchases.bill_date", filters.to);
  const { data } = await q;

  let flat: PurchaseRow[] = (data ?? []).map((r: any) => {
    const qty = Number(r.qty) || 0;
    const rate = Number(r.rate) || 0;
    return {
      id: r.id,
      payment_mode: r.purchases?.payment_mode ?? null,
      vendor: r.purchases?.vendors?.name ?? "—",
      location: r.purchases?.branches?.name ?? "—",
      bill_no: r.purchases?.bill_no ?? "—",
      bill_date: r.purchases?.bill_date ?? "—",
      category: r.category ?? "—",
      product: r.ingredients?.name ?? "—",
      uom: r.uom ?? "—",
      qty, rate,
      without_gst: qty * rate,
      with_gst: Number(r.line_total) || 0,
    };
  });

  if (filters.vendor) flat = flat.filter((r) => r.vendor === filters.vendor);
  if (filters.category) flat = flat.filter((r) => r.category === filters.category);
  if (filters.invoice) {
    const s = filters.invoice.toLowerCase();
    flat = flat.filter((r) => String(r.bill_no).toLowerCase().includes(s));
  }
  if (filters.search) {
    const s = filters.search.toLowerCase();
    flat = flat.filter((r) =>
      r.product.toLowerCase().includes(s) || r.vendor.toLowerCase().includes(s) || String(r.bill_no).toLowerCase().includes(s));
  }

  const sortKey = filters.sort ?? "bill_date";
  const sortDir = filters.dir ?? (filters.sort ? "asc" : "desc");
  flat.sort((a: any, b: any) => {
    const av = a[sortKey], bv = b[sortKey];
    const cmp = typeof av === "number" && typeof bv === "number"
      ? (av as number) - (bv as number)
      : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });
  const total = flat.length;
  const start = Math.max(0, (page - 1) * pageSize);
  return { rows: flat.slice(start, start + pageSize), total };
}

export async function getPurchaseMeta(orgId: string) {
  const supabase = await createClient();
  const [{ data: vendors }, { data: cats }] = await Promise.all([
    supabase.from("vendors").select("name").eq("org_id", orgId).eq("is_active", true).order("name"),
    supabase.from("categories").select("name").eq("org_id", orgId).eq("is_active", true).order("name"),
  ]);
  return {
    vendors: [...new Set((vendors ?? []).map((v: any) => v.name).filter(Boolean))],
    categories: [...new Set((cats ?? []).map((c: any) => c.name).filter(Boolean))],
  };
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
