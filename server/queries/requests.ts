import { createClient } from "@/lib/supabase/server";

export type ReqItem = { id: string; name: string; unit: string; reorder: number; max: number; qty: number; low: boolean; cost: number };

export async function getRequestFormData(orgId: string, branchId: string | null) {
  try {
    const supabase = await createClient();
    const ingQ = supabase.from("ingredients")
      .select("id, name, base_unit_id, reorder_level, max_level, material_type")
      .eq("org_id", orgId).eq("is_active", true).order("name");
    let stockQ = supabase.from("v_current_stock").select("ingredient_id, qty").eq("org_id", orgId);
    if (branchId) stockQ = stockQ.eq("branch_id", branchId);
    const unitQ = supabase.from("units").select("id, abbr").eq("org_id", orgId);
    let layerQ = supabase.from("inventory_cost_layers").select("ingredient_id, unit_cost, received_at").eq("org_id", orgId).order("received_at", { ascending: false });
    if (branchId) layerQ = layerQ.eq("branch_id", branchId);
    const vendorQ = supabase.from("vendors").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name");

    const [{ data: ings }, { data: stock }, { data: units }, { data: layers }, { data: vendors }] =
      await Promise.all([ingQ, stockQ, unitQ, layerQ, vendorQ]);

    const qty = new Map<string, number>();
    for (const s of stock ?? []) qty.set(s.ingredient_id, Number(s.qty) || 0);
    const uni = new Map((units ?? []).map((u: any) => [u.id, u.abbr]));
    const cost = new Map<string, number>();
    for (const l of layers ?? []) if (!cost.has(l.ingredient_id)) cost.set(l.ingredient_id, Number(l.unit_cost) || 0);

    const items: ReqItem[] = (ings ?? [])
      .filter((i: any) => i.material_type === "purchase" || i.material_type === "both")
      .map((i: any) => {
        const q = qty.get(i.id) ?? 0;
        const reorder = Number(i.reorder_level) || 0;
        return {
          id: i.id, name: i.name, unit: i.base_unit_id ? uni.get(i.base_unit_id) ?? "" : "",
          reorder, max: Number(i.max_level) || 0, qty: q,
          low: reorder > 0 && q <= reorder, cost: cost.get(i.id) ?? 0,
        };
      });

    return { items, vendors: vendors ?? [] };
  } catch (e) {
    console.error("getRequestFormData failed", e);
    return { items: [], vendors: [] };
  }
}

export async function getIndents(orgId: string, branchId: string | null, limit = 60) {
  try {
    const supabase = await createClient();
    let q = supabase.from("ops_indents").select("id, status, items, note, created_at, decided_at")
      .eq("org_id", orgId).order("created_at", { ascending: false }).limit(limit);
    if (branchId) q = q.eq("branch_id", branchId);
    const { data } = await q;
    return data ?? [];
  } catch { return []; }
}

export async function getPurchaseRequests(orgId: string, branchId: string | null, limit = 60) {
  try {
    const supabase = await createClient();
    let q = supabase.from("ops_purchase_requests").select("id, status, items, note, vendor_id, created_at, decided_at")
      .eq("org_id", orgId).order("created_at", { ascending: false }).limit(limit);
    if (branchId) q = q.eq("branch_id", branchId);
    const [{ data }, { data: vendors }] = await Promise.all([q, supabase.from("vendors").select("id, name").eq("org_id", orgId)]);
    const vmap = new Map((vendors ?? []).map((v: any) => [v.id, v.name]));
    return (data ?? []).map((r: any) => ({ ...r, vendor_name: r.vendor_id ? vmap.get(r.vendor_id) ?? "—" : "—" }));
  } catch { return []; }
}

export async function getInventoryCounts(orgId: string, branchId: string | null) {
  try {
    const supabase = await createClient();
    const fd = await getRequestFormData(orgId, branchId);
    const low = fd.items.filter((i) => i.low).length;
    let iQ = supabase.from("ops_indents").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending");
    let pQ = supabase.from("ops_purchase_requests").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending");
    if (branchId) { iQ = iQ.eq("branch_id", branchId); pQ = pQ.eq("branch_id", branchId); }
    const [{ count: indents }, { count: prs }] = await Promise.all([iQ, pQ]);
    return { low, pendingIndents: indents ?? 0, pendingPRs: prs ?? 0 };
  } catch { return { low: 0, pendingIndents: 0, pendingPRs: 0 }; }
}
