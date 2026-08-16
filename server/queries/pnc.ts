import { createClient } from "@/lib/supabase/server";

// ============================================================
// Production & Consumption — data layer
// Finished-goods stock is derived from the immutable stock_ledger;
// raw-material figures come from the existing inventory_movements.
// Everything is org + branch scoped and read-only here.
// ============================================================

const num = (v: unknown) => Number(v) || 0;
const daysBetween = (iso: string | null, now = Date.now()) =>
  iso ? Math.floor((now - new Date(iso).getTime()) / 86400000) : 0;

export type LedgerRow = {
  txn_type: string; item_id: string; batch_id: string | null; location: string | null;
  qty: number; total_value: number; txn_date: string;
};

async function loadLedger(orgId: string, branchId: string | null) {
  const supabase = await createClient();
  let q = supabase.from("stock_ledger")
    .select("txn_type, item_id, batch_id, location, qty, total_value, txn_date")
    .eq("org_id", orgId).eq("item_kind", "finished").limit(100000);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data } = await q;
  return (data ?? []) as LedgerRow[];
}

// on-hand qty by "item|location" and "batch|location"
function onHandMaps(rows: LedgerRow[]) {
  const byItemLoc = new Map<string, number>();
  const byBatchLoc = new Map<string, number>();
  const valueByLoc = new Map<string, number>();
  for (const r of rows) {
    const loc = r.location ?? "";
    byItemLoc.set(`${r.item_id}|${loc}`, (byItemLoc.get(`${r.item_id}|${loc}`) ?? 0) + num(r.qty));
    if (r.batch_id) byBatchLoc.set(`${r.batch_id}|${loc}`, (byBatchLoc.get(`${r.batch_id}|${loc}`) ?? 0) + num(r.qty));
    valueByLoc.set(loc, (valueByLoc.get(loc) ?? 0) + num(r.total_value));
  }
  return { byItemLoc, byBatchLoc, valueByLoc };
}

async function masters(orgId: string) {
  const supabase = await createClient();
  const [{ data: ings }, { data: units }, { data: recipes }] = await Promise.all([
    supabase.from("ingredients").select("id, name, base_unit_id, fulfillment, material_type").eq("org_id", orgId).eq("is_active", true).order("name"),
    supabase.from("units").select("id, abbr").eq("org_id", orgId),
    supabase.from("item_recipe").select("sales_item_id, component_id, qty").eq("org_id", orgId),
  ]);
  const uni = new Map((units ?? []).map((u: { id: string; abbr: string }) => [u.id, u.abbr]));
  const compCount = new Map<string, number>();
  for (const r of recipes ?? []) compCount.set(r.sales_item_id, (compCount.get(r.sales_item_id) ?? 0) + 1);
  const batchItems = (ings ?? []).filter((i: { fulfillment: string; material_type: string }) =>
    i.fulfillment === "stock" && (i.material_type === "sales" || i.material_type === "both"));
  const nameMap = new Map((ings ?? []).map((i: { id: string; name: string }) => [i.id, i.name]));
  const uomOf = (id: string, baseUnit: string | null) => (baseUnit ? uni.get(baseUnit) ?? "units" : "units");
  return { ings: ings ?? [], batchItems, compCount, nameMap, uomOf };
}

export type PncItem = { id: string; name: string; uom: string; components: number; store: number; display: number };

// ---- Production Log screen ----
export async function getProductionScreen(orgId: string, branchId: string | null) {
  const [{ batchItems, compCount, nameMap, uomOf }, ledger, recentRaw] = await Promise.all([
    masters(orgId), loadLedger(orgId, branchId),
    (async () => {
      const supabase = await createClient();
      let q = supabase.from("production_batch")
        .select("id, batch_code, sales_item_id, actual_yield, planned_qty, production_date, expiry_date, raw_material_cost, cost_per_stock_unit, status")
        .eq("org_id", orgId).order("created_at", { ascending: false }).limit(25);
      if (branchId) q = q.eq("branch_id", branchId);
      return (await q).data ?? [];
    })(),
  ]);
  const { byItemLoc } = onHandMaps(ledger);
  const items: PncItem[] = batchItems.map((s: { id: string; name: string; base_unit_id: string | null }) => ({
    id: s.id, name: s.name, uom: uomOf(s.id, s.base_unit_id),
    components: compCount.get(s.id) ?? 0,
    store: byItemLoc.get(`${s.id}|store`) ?? 0,
    display: byItemLoc.get(`${s.id}|display`) ?? 0,
  }));
  const now = Date.now();
  const recent = recentRaw.map((b: Record<string, unknown>) => ({
    id: b.id as string, code: b.batch_code as string, name: nameMap.get(b.sales_item_id as string) ?? "—",
    yield: num(b.actual_yield), planned: num(b.planned_qty), date: b.production_date as string,
    expiry: (b.expiry_date as string) ?? null, cost: num(b.raw_material_cost), cpu: num(b.cost_per_stock_unit),
    status: b.status as string,
    expiresInDays: b.expiry_date ? Math.ceil((new Date(b.expiry_date as string).getTime() - now) / 86400000) : null,
  }));
  return { items, recent };
}

// ---- Stock Transfer screen ----
export async function getTransferScreen(orgId: string, branchId: string | null) {
  const [{ batchItems, uomOf }, ledger, batchRows, yRaw] = await Promise.all([
    masters(orgId), loadLedger(orgId, branchId),
    (async () => {
      const supabase = await createClient();
      let q = supabase.from("production_batch").select("id, batch_code, sales_item_id, production_date, cost_per_stock_unit").eq("org_id", orgId).order("production_date");
      if (branchId) q = q.eq("branch_id", branchId);
      return (await q).data ?? [];
    })(),
    (async () => {
      const supabase = await createClient();
      const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      let q = supabase.from("stock_transfer").select("sales_item_id, qty").eq("org_id", orgId).eq("transfer_date", y);
      if (branchId) q = q.eq("branch_id", branchId);
      return (await q).data ?? [];
    })(),
  ]);
  const { byItemLoc, byBatchLoc } = onHandMaps(ledger);
  const items = batchItems.map((s: { id: string; name: string; base_unit_id: string | null }) => ({
    id: s.id, name: s.name, uom: uomOf(s.id, s.base_unit_id),
    store: byItemLoc.get(`${s.id}|store`) ?? 0,
    display: byItemLoc.get(`${s.id}|display`) ?? 0,
    batches: batchRows
      .filter((b: { sales_item_id: string }) => b.sales_item_id === s.id)
      .map((b: Record<string, unknown>) => ({ id: b.id as string, code: b.batch_code as string, producedOn: b.production_date as string, unitCost: num(b.cost_per_stock_unit), onHand: byBatchLoc.get(`${b.id}|store`) ?? 0 }))
      .filter((b) => b.onHand > 0),
  }));
  const yesterday = new Map<string, number>();
  for (const t of yRaw) yesterday.set(t.sales_item_id, (yesterday.get(t.sales_item_id) ?? 0) + num(t.qty));
  const repeat = items
    .filter((i) => yesterday.has(i.id))
    .map((i) => ({ id: i.id, name: i.name, qty: yesterday.get(i.id) ?? 0 }));
  return { items, repeat };
}

// ---- Wastage screen ----
export async function getWastageScreen(orgId: string, branchId: string | null) {
  const [{ batchItems, uomOf, nameMap }, ledger, recentRaw, costRaw] = await Promise.all([
    masters(orgId), loadLedger(orgId, branchId),
    (async () => {
      const supabase = await createClient();
      let q = supabase.from("wastage_entry").select("id, wastage_date, sales_item_id, location, qty, reason, value_lost").eq("org_id", orgId).order("created_at", { ascending: false }).limit(20);
      if (branchId) q = q.eq("branch_id", branchId);
      return (await q).data ?? [];
    })(),
    (async () => {
      const supabase = await createClient();
      let q = supabase.from("production_batch").select("sales_item_id, cost_per_stock_unit").eq("org_id", orgId);
      if (branchId) q = q.eq("branch_id", branchId);
      return (await q).data ?? [];
    })(),
  ]);
  const { byItemLoc } = onHandMaps(ledger);
  const costAgg = new Map<string, { sum: number; n: number }>();
  for (const c of costRaw as { sales_item_id: string; cost_per_stock_unit: unknown }[]) {
    const cost = num(c.cost_per_stock_unit); if (cost <= 0) continue;
    const a = costAgg.get(c.sales_item_id) ?? { sum: 0, n: 0 }; a.sum += cost; a.n += 1; costAgg.set(c.sales_item_id, a);
  }
  const items = batchItems.map((s: { id: string; name: string; base_unit_id: string | null }) => ({
    id: s.id, name: s.name, uom: uomOf(s.id, s.base_unit_id),
    store: byItemLoc.get(`${s.id}|store`) ?? 0, display: byItemLoc.get(`${s.id}|display`) ?? 0,
    unitCost: costAgg.has(s.id) ? costAgg.get(s.id)!.sum / costAgg.get(s.id)!.n : 0,
  }));
  const recent = recentRaw.map((w: Record<string, unknown>) => ({
    id: w.id as string, name: nameMap.get(w.sales_item_id as string) ?? "—", date: w.wastage_date as string,
    location: w.location as string, qty: num(w.qty), reason: w.reason as string, value: num(w.value_lost),
  }));
  return { items, recent };
}

// ---- Physical Count screen ----
export async function getCountScreen(orgId: string, branchId: string | null) {
  const [{ batchItems, uomOf, nameMap }, recentRaw] = await Promise.all([
    masters(orgId),
    (async () => {
      const supabase = await createClient();
      let q = supabase.from("physical_count").select("id, count_date, sales_item_id, location, system_qty, counted_qty, variance_qty, variance_value, approval_status").eq("org_id", orgId).order("created_at", { ascending: false }).limit(20);
      if (branchId) q = q.eq("branch_id", branchId);
      return (await q).data ?? [];
    })(),
  ]);
  const items = batchItems.map((s: { id: string; name: string; base_unit_id: string | null }) => ({ id: s.id, name: s.name, uom: uomOf(s.id, s.base_unit_id) }));
  const recent = recentRaw.map((c: Record<string, unknown>) => ({
    id: c.id as string, name: nameMap.get(c.sales_item_id as string) ?? "—", date: c.count_date as string,
    location: c.location as string, system: num(c.system_qty), counted: num(c.counted_qty),
    variance: num(c.variance_qty), value: num(c.variance_value), status: c.approval_status as string,
  }));
  return { items, recent };
}

// ---- Consumption Report (3 tabs) ----
export async function getConsumptionReport(orgId: string, branchId: string | null, from: string, to: string) {
  const supabase = await createClient();
  const { batchItems, nameMap, uomOf, ings } = await masters(orgId);

  // ---------- Tab 1: Raw material consumption (from inventory_movements) ----------
  let mq = supabase.from("inventory_movements").select("ingredient_id, movement_type, qty, unit_cost, source_table, occurred_at").eq("org_id", orgId).limit(200000);
  if (branchId) mq = mq.eq("branch_id", branchId);
  const { data: moves } = await mq;
  const rawAgg = new Map<string, { opening: number; purchased: number; consumed: number; backflushed: number; wastage: number }>();
  for (const m of moves ?? []) {
    const d = (m.occurred_at as string)?.slice(0, 10) ?? "";
    const key = m.ingredient_id as string;
    const a = rawAgg.get(key) ?? { opening: 0, purchased: 0, consumed: 0, backflushed: 0, wastage: 0 };
    const q = num(m.qty);
    if (d < from) { a.opening += q; }
    else if (d <= to) {
      if (m.movement_type === "purchase") a.purchased += q;
      else if (m.movement_type === "wastage") a.wastage += -q;
      else if (m.movement_type === "consumption") { if (m.source_table === "pos_sales") a.backflushed += -q; else a.consumed += -q; }
      else a.opening += q; // adjustments/opening/transfer carried into base
    }
    rawAgg.set(key, a);
  }
  // physical (current) stock for raw
  let cs = supabase.from("v_current_stock").select("ingredient_id, qty").eq("org_id", orgId);
  if (branchId) cs = cs.eq("branch_id", branchId);
  const { data: cstock } = await cs;
  const physRaw = new Map((cstock ?? []).map((c: { ingredient_id: string; qty: unknown }) => [c.ingredient_id, num(c.qty)]));
  const rawIngs = ings.filter((i: { material_type: string }) => i.material_type === "purchase" || i.material_type === "both");
  const raw = rawIngs.map((i: { id: string; name: string; base_unit_id: string | null }) => {
    const a = rawAgg.get(i.id) ?? { opening: 0, purchased: 0, consumed: 0, backflushed: 0, wastage: 0 };
    const closing = a.opening + a.purchased - a.consumed - a.backflushed - a.wastage;
    const physical = physRaw.get(i.id) ?? 0;
    const varQty = physical - closing;
    return {
      id: i.id, name: i.name, uom: uomOf(i.id, i.base_unit_id),
      opening: a.opening, purchased: a.purchased, consumed: a.consumed, backflushed: a.backflushed,
      wastage: a.wastage, closing, physical, varianceQty: varQty,
      variancePct: closing !== 0 ? (varQty / Math.abs(closing)) * 100 : 0,
      varianceValue: 0,
    };
  }).filter((r) => r.opening || r.purchased || r.consumed || r.backflushed || r.wastage || r.physical)
    .sort((a, b) => Math.abs(b.varianceQty) - Math.abs(a.varianceQty));

  // ---------- Tab 2 & 3: Finished goods (from stock_ledger) ----------
  const ledger = await loadLedger(orgId, branchId);
  const { byBatchLoc } = onHandMaps(ledger);
  let bq = supabase.from("production_batch").select("id, batch_code, sales_item_id, production_date, expiry_date, cost_per_stock_unit").eq("org_id", orgId);
  if (branchId) bq = bq.eq("branch_id", branchId);
  const { data: batches } = await bq;
  const now = Date.now();

  type FinAgg = { opening: number; produced: number; tIn: number; tOut: number; sold: number; wasted: number; closingVal: number };
  const finAgg = new Map<string, FinAgg>();
  const ensure = (id: string) => { let a = finAgg.get(id); if (!a) { a = { opening: 0, produced: 0, tIn: 0, tOut: 0, sold: 0, wasted: 0, closingVal: 0 }; finAgg.set(id, a); } return a; };
  for (const r of ledger) {
    const a = ensure(r.item_id);
    const d = (r.txn_date ?? "").slice(0, 10);
    const q = num(r.qty);
    a.closingVal += num(r.total_value);
    if (d < from) { a.opening += q; continue; }
    if (d > to) continue;
    if (r.txn_type === "production_output") a.produced += q;
    else if (r.txn_type === "transfer") { if (q > 0) a.tIn += q; else a.tOut += -q; }
    else if (r.txn_type === "sale") a.sold += -q;
    else if (r.txn_type === "wastage") a.wasted += -q;
    else a.opening += q; // adjustment/reversal fold into base
  }
  const finished = batchItems.map((s: { id: string; name: string; base_unit_id: string | null }) => {
    const a = finAgg.get(s.id) ?? { opening: 0, produced: 0, tIn: 0, tOut: 0, sold: 0, wasted: 0, closingVal: 0 };
    const closing = a.opening + a.produced + a.tIn - a.tOut - a.sold - a.wasted;
    const itemBatches = (batches ?? []).filter((b: { sales_item_id: string }) => b.sales_item_id === s.id).map((b: Record<string, unknown>) => {
      const store = byBatchLoc.get(`${b.id}|store`) ?? 0, display = byBatchLoc.get(`${b.id}|display`) ?? 0;
      return {
        code: b.batch_code as string, onHand: store + display,
        ageDays: daysBetween(b.production_date as string, now),
        expiry: (b.expiry_date as string) ?? null,
        expiresInDays: b.expiry_date ? Math.ceil((new Date(b.expiry_date as string).getTime() - now) / 86400000) : null,
      };
    }).filter((b) => b.onHand > 0.0001);
    return {
      id: s.id, name: s.name, uom: uomOf(s.id, s.base_unit_id),
      opening: a.opening, produced: a.produced, transferIn: a.tIn, transferOut: a.tOut,
      sold: a.sold, wasted: a.wasted, closing, closingValue: a.closingVal, batches: itemBatches,
    };
  }).filter((f) => f.opening || f.produced || f.sold || f.wasted || f.closing || f.batches.length);

  // ---------- Tab 3: Production vs Sales reconciliation ----------
  const recon = finished.map((f) => {
    const available = f.opening + f.produced + f.transferIn;
    const sellThrough = available > 0 ? (f.sold / available) * 100 : 0;
    const oldest = f.batches.reduce((m, b) => Math.max(m, b.ageDays), 0);
    const soldPerDay = f.sold > 0 ? f.sold / Math.max(1, daysSpan(from, to)) : 0;
    const daysCover = soldPerDay > 0 ? f.closing / soldPerDay : (f.closing > 0 ? Infinity : 0);
    let nearestExpiry: number | null = null;
    for (const b of f.batches) { if (b.expiresInDays != null) nearestExpiry = nearestExpiry == null ? b.expiresInDays : Math.min(nearestExpiry, b.expiresInDays); }
    const flags: string[] = [];
    if (available > 0 && sellThrough < 40 && f.produced > 0) flags.push("overproduced");
    if (soldPerDay > 0 && daysCover > 5) flags.push("slow-moving");
    if (nearestExpiry != null && nearestExpiry <= 2) flags.push("ageing");
    return {
      id: f.id, name: f.name, uom: f.uom, opening: f.opening, produced: f.produced, available,
      sold: f.sold, sellThrough, closing: f.closing,
      daysCover: daysCover === Infinity ? null : daysCover, oldestDays: oldest, nearestExpiry, flags,
    };
  }).sort((a, b) => a.sellThrough - b.sellThrough);

  return { raw, finished, recon };
}

function daysSpan(from: string, to: string) {
  return Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1);
}

// ---- Hub overview + dashboard KPIs + AI facts ----
export async function getPncOverview(orgId: string, branchId: string | null) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ nameMap }, ledger] = await Promise.all([masters(orgId), loadLedger(orgId, branchId)]);
  const { byItemLoc, valueByLoc } = onHandMaps(ledger);

  const [{ data: exc }, { data: closed }, { data: batches }, { data: wToday }, { data: rawToday }] = await Promise.all([
    (async () => { let q = supabase.from("pos_exception").select("id, item_name, qty, reason, sale_date").eq("org_id", orgId).is("resolved_at", null).order("created_at", { ascending: false }).limit(20); if (branchId) q = q.eq("branch_id", branchId); return await q; })(),
    (async () => { let q = supabase.from("consumption_period").select("business_date").eq("org_id", orgId).eq("business_date", today).eq("status", "closed").limit(1); if (branchId) q = q.eq("branch_id", branchId); return await q; })(),
    (async () => { let q = supabase.from("production_batch").select("id, batch_code, sales_item_id, expiry_date, actual_yield, planned_qty, production_date").eq("org_id", orgId).eq("status", "active"); if (branchId) q = q.eq("branch_id", branchId); return await q; })(),
    (async () => { let q = supabase.from("wastage_entry").select("value_lost").eq("org_id", orgId).eq("wastage_date", today); if (branchId) q = q.eq("branch_id", branchId); return await q; })(),
    (async () => { let q = supabase.from("inventory_movements").select("qty, unit_cost, occurred_at").eq("org_id", orgId).eq("movement_type", "consumption").gte("occurred_at", today); if (branchId) q = q.eq("branch_id", branchId); return await q; })(),
  ]);
  const rawConsumedToday = (rawToday ?? []).reduce((s: number, m: { qty: unknown; unit_cost: unknown }) => s + Math.abs(num(m.qty)) * num(m.unit_cost), 0);
  const now = Date.now();
  const producedToday = ledger.filter((r) => r.txn_type === "production_output" && r.txn_date.slice(0, 10) === today).reduce((s, r) => s + num(r.qty), 0);
  const nearExpiry = (batches ?? []).map((b: Record<string, unknown>) => {
    const on = (byItemLoc.get(`${b.sales_item_id}|store`) ?? 0) + (byItemLoc.get(`${b.sales_item_id}|display`) ?? 0);
    const d = b.expiry_date ? Math.ceil((new Date(b.expiry_date as string).getTime() - now) / 86400000) : null;
    return { code: b.batch_code as string, name: nameMap.get(b.sales_item_id as string) ?? "—", expiresInDays: d };
  }).filter((b) => b.expiresInDays != null && (b.expiresInDays as number) <= 3);
  const effVals = (batches ?? []).filter((b: Record<string, unknown>) => num(b.planned_qty) > 0).map((b: Record<string, unknown>) => num(b.actual_yield) / num(b.planned_qty));
  const efficiency = effVals.length ? (effVals.reduce((s, v) => s + v, 0) / effVals.length) * 100 : 0;

  return {
    storeValue: valueByLoc.get("store") ?? 0,
    displayValue: valueByLoc.get("display") ?? 0,
    rawConsumedToday,
    producedToday,
    wastageToday: (wToday ?? []).reduce((s: number, w: { value_lost: unknown }) => s + num(w.value_lost), 0),
    dayClosed: (closed ?? []).length > 0,
    efficiency,
    nearExpiry,
    exceptions: (exc ?? []).map((e: Record<string, unknown>) => ({ id: e.id as string, item: (e.item_name as string) ?? "—", qty: num(e.qty), reason: e.reason as string, date: e.sale_date as string })),
  };
}

// Compact, deterministic facts for the AI Analyst.
export async function getPncAiFacts(orgId: string, branchId: string | null) {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const rep = await getConsumptionReport(orgId, branchId, from, to);
  const overproduced = rep.recon.filter((r) => r.flags.includes("overproduced")).slice(0, 5).map((r) => ({ name: r.name, sellThroughPct: Math.round(r.sellThrough), produced: r.produced, sold: r.sold }));
  const lowSellThrough = [...rep.recon].filter((r) => r.produced > 0).sort((a, b) => a.sellThrough - b.sellThrough).slice(0, 5).map((r) => ({ name: r.name, sellThroughPct: Math.round(r.sellThrough) }));
  const wastage = [...rep.raw].sort((a, b) => b.wastage - a.wastage).filter((r) => r.wastage > 0).slice(0, 5).map((r) => ({ name: r.name, wastedQty: Math.round(r.wastage * 100) / 100, uom: r.uom }));
  const expiringSoon = rep.finished.flatMap((f) => f.batches.filter((b) => b.expiresInDays != null && (b.expiresInDays as number) <= 3).map((b) => ({ item: f.name, batch: b.code, expiresInDays: b.expiresInDays })));
  const losses = [...rep.recon].filter((r) => r.flags.includes("ageing") || r.flags.includes("slow-moving")).slice(0, 5).map((r) => ({ name: r.name, closing: r.closing, oldestDays: r.oldestDays }));
  return { window: { from, to }, overproduced, lowSellThrough, highestWastage: wastage, expiringSoon, agingLosses: losses };
}
