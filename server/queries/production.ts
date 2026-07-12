import { createClient } from "@/lib/supabase/server";

export type StockItem = {
  id: string; name: string; uom: string;
  components: number; onHand: number;
};

export async function getProductionData(orgId: string, branchId: string | null) {
  try {
    const supabase = await createClient();
    const { data: ings } = await supabase.from("ingredients")
      .select("id, name, base_unit_id, fulfillment, material_type")
      .eq("org_id", orgId).eq("is_active", true).order("name");

    const stock = (ings ?? []).filter(
      (i: any) => i.fulfillment === "stock" && (i.material_type === "sales" || i.material_type === "both"),
    );
    const ids = stock.map((s: any) => s.id);

    const [{ data: recipes }, { data: cstock }, { data: units }, { data: prods }] = await Promise.all([
      supabase.from("item_recipe").select("sales_item_id, component_id").eq("org_id", orgId),
      (() => { let q = supabase.from("v_current_stock").select("ingredient_id, qty").eq("org_id", orgId); if (branchId) q = q.eq("branch_id", branchId); return q; })(),
      supabase.from("units").select("id, abbr").eq("org_id", orgId),
      (() => { let q = supabase.from("productions").select("id, sales_item_id, qty, produced_on, note, created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(25); if (branchId) q = q.eq("branch_id", branchId); return q; })(),
    ]);

    const compCount = new Map<string, number>();
    for (const r of recipes ?? []) if (ids.includes(r.sales_item_id)) compCount.set(r.sales_item_id, (compCount.get(r.sales_item_id) ?? 0) + 1);
    const qtyMap = new Map<string, number>();
    for (const c of cstock ?? []) qtyMap.set(c.ingredient_id, Number(c.qty) || 0);
    const uni = new Map((units ?? []).map((u: any) => [u.id, u.abbr]));
    const nameMap = new Map((ings ?? []).map((i: any) => [i.id, i.name]));

    const stockItems: StockItem[] = stock.map((s: any) => ({
      id: s.id, name: s.name,
      uom: s.base_unit_id ? uni.get(s.base_unit_id) ?? "units" : "units",
      components: compCount.get(s.id) ?? 0,
      onHand: qtyMap.get(s.id) ?? 0,
    }));

    const recent = (prods ?? []).map((p: any) => ({
      id: p.id, name: nameMap.get(p.sales_item_id) ?? "—",
      qty: Number(p.qty) || 0, produced_on: p.produced_on, note: p.note ?? "",
    }));

    return { stockItems, recent };
  } catch (e) {
    console.error("getProductionData failed", e);
    return { stockItems: [], recent: [] };
  }
}
