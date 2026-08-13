import { createClient } from "@/lib/supabase/server";

export type PurchaseSortKey =
  | "payment_mode" | "vendor" | "location" | "bill_no" | "bill_date"
  | "category" | "product" | "purchase_uom" | "pack_qty" | "pack_size"
  | "total_qty" | "unit_price" | "without_gst" | "with_gst";

export type PurchaseFilters = {
  search?: string; vendor?: string; from?: string; to?: string; invoice?: string; category?: string;
  payment?: "paid" | "unpaid";
  sort?: PurchaseSortKey; dir?: "asc" | "desc";
};

export type PurchaseRow = {
  id: string; purchase_id: string; payment_mode: string | null; vendor: string; location: string;
  payment_status: string; paid_on: string | null;
  bill_no: string; bill_date: string; category: string; product: string;
  purchase_uom: string;            // packaging label (Packet, Bottle, …)
  pack_qty: number | null;         // number of packages
  pack_size: number | null;        // qty inside one package (value)
  pack_unit: string;               // pack-size unit (g, kg, ml, …)
  total_qty: number;               // base/inventory quantity
  base_uom: string;                // base/inventory unit (g, ml, pcs)
  unit_price: number | null;       // price per package
  without_gst: number; with_gst: number;
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
      pack_qty, pack_size, purchase_uom, unit_price,
      pack_unit:pack_size_unit_id(abbr),
      ingredients(name),
      purchases!inner(id, bill_no, bill_date, payment_mode, payment_status, paid_on, org_id, branch_id, vendors(name), branches(name))
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
      purchase_id: r.purchases?.id ?? "",
      payment_mode: r.purchases?.payment_mode ?? null,
      payment_status: r.purchases?.payment_status ?? "unpaid",
      paid_on: r.purchases?.paid_on ?? null,
      vendor: r.purchases?.vendors?.name ?? "—",
      location: r.purchases?.branches?.name ?? "—",
      bill_no: r.purchases?.bill_no ?? "—",
      bill_date: r.purchases?.bill_date ?? "—",
      category: r.category ?? "—",
      product: r.ingredients?.name ?? "—",
      purchase_uom: r.purchase_uom ?? "—",
      pack_qty: r.pack_qty != null ? Number(r.pack_qty) : null,
      pack_size: r.pack_size != null ? Number(r.pack_size) : null,
      pack_unit: r.pack_unit?.abbr ?? (r.uom ?? ""),
      total_qty: qty,
      base_uom: r.uom ?? "",
      unit_price: r.unit_price != null ? Number(r.unit_price) : null,
      without_gst: qty * rate,
      with_gst: Number(r.line_total) || 0,
    };
  });

  if (filters.vendor) flat = flat.filter((r) => r.vendor === filters.vendor);
  if (filters.category) flat = flat.filter((r) => r.category === filters.category);
  if (filters.payment === "unpaid") flat = flat.filter((r) => r.payment_status !== "paid");
  if (filters.payment === "paid") flat = flat.filter((r) => r.payment_status === "paid");
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
    const av = a[sortKey] ?? "", bv = b[sortKey] ?? "";
    const cmp = typeof av === "number" && typeof bv === "number"
      ? (av as number) - (bv as number)
      : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });
  const total = flat.length;
  const start = Math.max(0, (page - 1) * pageSize);
  return { rows: flat.slice(start, start + pageSize), total };
}

// Total unpaid vendor bills (matches the AI payables figure): sum of bill
// totals where payment_status is not 'paid', scoped to org + optional branch.
export async function getOutstandingPayables(orgId: string, branchId: string | null): Promise<number> {
  const supabase = await createClient();
  let q = supabase.from("purchases").select("total, payment_status").eq("org_id", orgId).limit(20000);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data } = await q;
  return (data ?? [])
    .filter((r: any) => r.payment_status && r.payment_status !== "paid")
    .reduce((s: number, r: any) => s + (Number(r.total) || 0), 0);
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

export type FormUnit = { id: string; name: string; abbr: string; factor_to_base: number };
export type FormIngredient = {
  id: string; name: string; default_gst_rate: number; default_vendor_id: string;
  category_name: string; base_unit_id: string; base_uom: string; base_factor: number; last_price: number;
};

export async function getPurchaseFormData(orgId: string) {
  const supabase = await createClient();
  const [{ data: vendors }, { data: branches }, { data: ings }, { data: cats }, { data: units }, { data: vi }] =
    await Promise.all([
      supabase.from("vendors").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name"),
      supabase.from("branches").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name"),
      supabase.from("ingredients").select("id, name, category_id, base_unit_id, default_gst_rate, default_vendor_id")
        .eq("org_id", orgId).eq("is_active", true).in("material_type", ["purchase", "both"]).order("name"),
      supabase.from("categories").select("id, name").eq("org_id", orgId).eq("is_active", true),
      supabase.from("units").select("id, name, abbr, factor_to_base").eq("org_id", orgId).eq("is_active", true).order("name"),
      supabase.from("vendor_ingredients").select("ingredient_id, vendor_id, last_price"),
    ]);

  const cat = new Map((cats ?? []).map((c) => [c.id, c.name]));
  const uAbbr = new Map((units ?? []).map((u: any) => [u.id, u.abbr]));
  const uFactor = new Map((units ?? []).map((u: any) => [u.id, Number(u.factor_to_base) || 1]));
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

  const ingredients: FormIngredient[] = (ings ?? []).map((i: any) => ({
    id: i.id,
    name: i.name,
    default_gst_rate: Number(i.default_gst_rate) || 0,
    default_vendor_id: i.default_vendor_id ?? "",
    category_name: i.category_id ? cat.get(i.category_id) ?? "" : "",
    base_unit_id: i.base_unit_id ?? "",
    base_uom: i.base_unit_id ? uAbbr.get(i.base_unit_id) ?? "" : "",
    base_factor: i.base_unit_id ? uFactor.get(i.base_unit_id) ?? 1 : 1,
    last_price: priceByIng.get(i.id) ?? 0,
  }));

  const formUnits: FormUnit[] = (units ?? []).map((u: any) => ({
    id: u.id, name: u.name, abbr: u.abbr, factor_to_base: Number(u.factor_to_base) || 1,
  }));

  const categoryNames = [...new Set((cats ?? []).map((c: any) => c.name).filter(Boolean))] as string[];

  return { vendors: vendors ?? [], branches: branches ?? [], ingredients, units: formUnits, categories: categoryNames };
}

export type PurchaseEditLine = {
  ingredient_id: string; category: string; purchase_uom: string;
  pack_qty: string; pack_size: string; pack_size_unit_id: string; unit_price: string; gst_rate: string;
};
export type PurchaseEditData = {
  id: string; vendor_id: string; branch_id: string; payment_mode: string;
  bill_no: string; bill_date: string; lines: PurchaseEditLine[];
};

export async function getPurchaseForEdit(orgId: string, id: string): Promise<PurchaseEditData | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchases")
    .select(`
      id, vendor_id, branch_id, payment_mode, bill_no, bill_date,
      purchase_items(ingredient_id, category, uom, qty, rate, line_total, gst_rate,
        pack_qty, pack_size, pack_size_unit_id, purchase_uom, unit_price,
        ingredients(base_unit_id))
    `)
    .eq("id", id).eq("org_id", orgId).single();
  if (!data) return null;
  const p: any = data;
  return {
    id: p.id,
    vendor_id: p.vendor_id ?? "",
    branch_id: p.branch_id ?? "",
    payment_mode: p.payment_mode ?? "credit",
    bill_no: p.bill_no ?? "",
    bill_date: (p.bill_date ?? new Date().toISOString().slice(0, 10)) as string,
    lines: (p.purchase_items ?? []).map((it: any) => {
      const isNew = it.pack_qty != null;
      const baseUnit = it.ingredients?.base_unit_id ?? "";
      const qty = Number(it.qty) || 0;
      const rate = Number(it.rate) || 0;
      return {
        ingredient_id: it.ingredient_id ?? "",
        category: it.category ?? "",
        purchase_uom: it.purchase_uom ?? "",
        // Old record → treat as 1 package holding its whole base quantity (lossless).
        pack_qty: isNew ? String(it.pack_qty) : "1",
        pack_size: isNew ? String(it.pack_size ?? "") : String(qty),
        pack_size_unit_id: it.pack_size_unit_id ?? baseUnit,
        unit_price: it.unit_price != null ? String(it.unit_price) : String(qty * rate),
        gst_rate: String(it.gst_rate ?? 0),
      };
    }),
  };
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
