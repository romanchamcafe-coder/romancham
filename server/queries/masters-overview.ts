import { createClient } from "@/lib/supabase/server";

// Read-only overview of all master data for the Masters hub (counts + lists).
export async function getMastersOverview(orgId: string) {
  const supabase = await createClient();
  const [{ data: units }, { data: cats }, { data: ings }, { data: vendors }] = await Promise.all([
    supabase.from("units").select("id, name, abbr, factor_to_base, base_unit_id").eq("org_id", orgId).eq("is_active", true).order("abbr"),
    supabase.from("categories").select("id, name, type").eq("org_id", orgId).eq("is_active", true).order("name"),
    supabase.from("ingredients")
      .select("id, name, material_type, category_id, base_unit_id, default_vendor_id, default_gst_rate, hsn_code, pack_content_qty, pack_content_unit_id, yield_pct")
      .eq("org_id", orgId).eq("is_active", true).order("name"),
    supabase.from("vendors").select("id, name, gstin, state_code, phone, email, payment_terms_days").eq("org_id", orgId).eq("is_active", true).order("name"),
  ]);
  const U = units ?? [], C = cats ?? [], I = ings ?? [], V = vendors ?? [];
  const uAbbr = new Map(U.map((u: any) => [u.id, u.abbr]));
  const cName = new Map(C.map((c: any) => [c.id, c.name]));
  const vName = new Map(V.map((v: any) => [v.id, v.name]));
  const count = (key: string) => { const m = new Map<string, number>(); for (const i of I as any[]) if (i[key]) m.set(i[key], (m.get(i[key]) ?? 0) + 1); return m; };
  const byUnit = count("base_unit_id"), byCat = count("category_id"), byVendor = count("default_vendor_id");

  const TYPE: Record<string, string> = { purchase: "Purchase", sales: "Sales", both: "Both", prep: "Prep" };
  return {
    units: U.map((u: any) => ({ abbr: u.abbr, name: u.name, factor: Number(u.factor_to_base) || 1, base: u.base_unit_id ? uAbbr.get(u.base_unit_id) ?? "" : "", items: byUnit.get(u.id) ?? 0 })),
    categories: C.map((c: any) => ({ name: c.name, type: c.type === "expense" ? "Expense" : "Ingredient", items: byCat.get(c.id) ?? 0 })),
    ingredients: I.map((i: any) => ({
      name: i.name, type: TYPE[i.material_type] ?? i.material_type, category: i.category_id ? cName.get(i.category_id) ?? "—" : "—",
      uom: i.base_unit_id ? uAbbr.get(i.base_unit_id) ?? "—" : "—",
      pack: i.pack_content_qty && i.pack_content_unit_id ? `1 = ${Number(i.pack_content_qty)} ${uAbbr.get(i.pack_content_unit_id) ?? ""}` : "",
      gst: Number(i.default_gst_rate) || 0, yieldPct: i.yield_pct == null ? 100 : Number(i.yield_pct),
      vendor: i.default_vendor_id ? vName.get(i.default_vendor_id) ?? "—" : "—", hsn: i.hsn_code ?? "",
    })),
    vendors: V.map((v: any) => ({ name: v.name, gstin: v.gstin ?? "", state: v.state_code ?? "", phone: v.phone ?? "", email: v.email ?? "", terms: v.payment_terms_days ?? 0, items: byVendor.get(v.id) ?? 0 })),
  };
}
export type MastersOverview = Awaited<ReturnType<typeof getMastersOverview>>;
