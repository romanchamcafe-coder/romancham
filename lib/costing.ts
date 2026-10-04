// ============================================================
// Romancham — THE costing engine (single source of truth).
//
//   RAW INGREDIENT  (purchase cost per base unit ÷ usable yield %)
//        ↓
//   PREP / COMPONENT (batch cost ÷ FINAL yield = cost per g/ml/pc)
//        ↓  (preps can contain other preps — any depth)
//   FINAL DISH      (food cost per portion = Σ lines)
//        ↓
//   MENU ENGINEERING (lib/menu-pricing.ts adds labour/overhead/etc.)
//
// Pure functions only — no DB access — so the Recipes page, Menu
// Engineering, imports and tests all share exactly the same maths.
//
// Storage convention (item_recipe):
//   qty = quantity of the component, in the COMPONENT's base unit, needed
//         to make ONE base unit of the PARENT's output
//         (1 g of a prep, or 1 portion of a dish).
//   For a prep with yield Y: qty = batch quantity (in base units) ÷ Y.
//   This keeps every stock/production function in SQL unchanged.
// ============================================================

export type ItemKind = "raw" | "prep" | "dish";

export type CostUnit = { id: string; abbr: string; name?: string; factor_to_base?: number };
export type CostItem = {
  id: string; name: string; kind: ItemKind; baseUnitId: string | null;
  /** Latest purchase cost per BASE unit (raw items only). */
  purchaseUnitCost?: number;
  /** Usable yield after trimming/peeling, 1–100 (raw items only). Default 100. */
  yieldPct?: number | null;
  /** Pack content: ONE base unit contains `contentQty` of `contentUnitId`
   *  (e.g. base "qty"/pack, 1 pack = 400 gms). Lets recipes use grams for items bought per pack. */
  contentQty?: number | null; contentUnitId?: string | null;
};
export type RecipeHeader = { itemId: string; type: "prep" | "dish"; yieldQty: number; notes?: string | null; shelfLifeDays?: number | null };
export type RecipeLine = {
  parentId: string; componentId: string;
  /** Normalised: component base units per 1 base unit of parent output. */
  qty: number;
  entryQty?: number | null; entryUnitId?: string | null; sortOrder?: number | null;
};

// ---------- units ----------
type Family = "mass" | "volume" | "count";
const CANON: Record<string, { family: Family; factor: number }> = {
  mg: { family: "mass", factor: 0.001 }, g: { family: "mass", factor: 1 }, gm: { family: "mass", factor: 1 }, gms: { family: "mass", factor: 1 },
  gram: { family: "mass", factor: 1 }, grams: { family: "mass", factor: 1 }, kg: { family: "mass", factor: 1000 }, kgs: { family: "mass", factor: 1000 },
  ml: { family: "volume", factor: 1 }, mls: { family: "volume", factor: 1 }, l: { family: "volume", factor: 1000 }, lt: { family: "volume", factor: 1000 },
  ltr: { family: "volume", factor: 1000 }, ltrs: { family: "volume", factor: 1000 }, lts: { family: "volume", factor: 1000 }, litre: { family: "volume", factor: 1000 }, liter: { family: "volume", factor: 1000 },
  pc: { family: "count", factor: 1 }, pcs: { family: "count", factor: 1 }, piece: { family: "count", factor: 1 }, pieces: { family: "count", factor: 1 },
  no: { family: "count", factor: 1 }, nos: { family: "count", factor: 1 }, unit: { family: "count", factor: 1 }, units: { family: "count", factor: 1 },
  qty: { family: "count", factor: 1 }, each: { family: "count", factor: 1 }, dz: { family: "count", factor: 12 }, dozen: { family: "count", factor: 12 },
};
export function unitInfo(u: CostUnit | undefined | null): { family: string; factor: number } {
  if (!u) return { family: "none", factor: 1 };
  const c = CANON[(u.abbr || "").trim().toLowerCase()];
  if (c) return c;
  return { family: `own:${u.id}`, factor: 1 }; // unknown unit: only converts to itself
}

/** Convert qty from one unit to another. Returns null if the units are incompatible. */
export function convertQty(qty: number, from: CostUnit | null | undefined, to: CostUnit | null | undefined): number | null {
  if (!from || !to || from.id === to.id) return qty;
  const a = unitInfo(from), b = unitInfo(to);
  if (a.family !== b.family) return null;
  return (qty * a.factor) / b.factor;
}

/**
 * Convert a quantity of a specific ITEM between units, also across the item's
 * pack content (e.g. Epigamia: 1 qty = 400 gms → 100 gms = 0.25 qty).
 */
export function convertForItem(qty: number, from: CostUnit | null | undefined, to: CostUnit | null | undefined, item: CostItem | undefined, units: Map<string, CostUnit>): number | null {
  const direct = convertQty(qty, from, to);
  if (direct != null) return direct;
  if (!item || !(Number(item.contentQty) > 0) || !item.contentUnitId) return null;
  const base = item.baseUnitId ? units.get(item.baseUnitId) : undefined;
  const content = units.get(item.contentUnitId);
  if (!base || !content) return null;
  const n = Number(item.contentQty);
  // from content-family → base-family
  const inContent = convertQty(qty, from, content);
  if (inContent != null) { const inBase = inContent / n; return convertQty(inBase, base, to); }
  // from base-family → content-family
  const inBase = convertQty(qty, from, base);
  if (inBase != null) return convertQty(inBase * n, content, to);
  return null;
}

/** Units a recipe line for this item may be entered in (base family + pack-content family). */
export function compatibleUnits(item: CostItem | undefined, units: CostUnit[]): CostUnit[] {
  if (!item?.baseUnitId) return units;
  const map = new Map(units.map((u) => [u.id, u]));
  const fams = new Set([unitInfo(map.get(item.baseUnitId)).family]);
  if (item.contentUnitId && Number(item.contentQty) > 0) fams.add(unitInfo(map.get(item.contentUnitId)).family);
  return units.filter((u) => fams.has(unitInfo(u).family));
}

// ---------- errors ----------
export type CostIssue =
  | { code: "cycle"; path: string[] }
  | { code: "zero_yield"; itemId: string }
  | { code: "bad_yield_pct"; itemId: string }
  | { code: "no_cost"; itemId: string }
  | { code: "missing_item"; itemId: string };

export type Breakdown = {
  componentId: string; name: string; kind: ItemKind | "missing";
  qty: number; unitAbbr: string;          // quantity shown in the line (entry units if known)
  baseQty: number; baseUnitAbbr: string;  // quantity in component base units (per parent batch/portion)
  unitCost: number;                        // cost per component base unit (usable)
  lineCost: number;
  children?: Breakdown[];                 // expandable: what the prep is made of, scaled to this line
};

export type CostResult = {
  itemId: string; kind: ItemKind;
  /** Cost per ONE base unit of the item (per g of prep, per portion of dish, per base unit of raw — usable). */
  unitCost: number;
  /** Prep: whole batch cost. Dish: cost of the recipe batch (= food cost × yield portions). Raw: = unitCost. */
  batchCost: number;
  yieldQty: number;
  inputQtyBase: number | null;  // sum of same-family inputs (prep), to contrast with final yield
  hasRecipe: boolean;
  issues: CostIssue[];
};

export class CostBook {
  private items: Map<string, CostItem>;
  private units: Map<string, CostUnit>;
  private headers: Map<string, RecipeHeader>;
  private linesBy: Map<string, RecipeLine[]>;
  private memo = new Map<string, number>();
  private stack: string[] = [];
  private issues = new Map<string, CostIssue[]>();

  constructor(input: { items: CostItem[]; units: CostUnit[]; headers: RecipeHeader[]; lines: RecipeLine[] }) {
    this.items = new Map(input.items.map((i) => [i.id, i]));
    this.units = new Map(input.units.map((u) => [u.id, u]));
    this.headers = new Map(input.headers.map((h) => [h.itemId, h]));
    this.linesBy = new Map();
    for (const l of input.lines) {
      const arr = this.linesBy.get(l.parentId) ?? [];
      arr.push(l); this.linesBy.set(l.parentId, arr);
    }
    for (const arr of this.linesBy.values()) arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  item(id: string) { return this.items.get(id); }
  unit(id: string | null | undefined) { return id ? this.units.get(id) : undefined; }
  header(id: string) { return this.headers.get(id); }
  lines(id: string) { return this.linesBy.get(id) ?? []; }
  private note(id: string, i: CostIssue) { const a = this.issues.get(id) ?? []; a.push(i); this.issues.set(id, a); }

  /** Usable cost per 1 base unit of any item. Cycles/missing data contribute 0 and are reported. */
  unitCost(id: string): number {
    if (this.memo.has(id)) return this.memo.get(id)!;
    const it = this.items.get(id);
    if (!it) { this.note(id, { code: "missing_item", itemId: id }); return 0; }
    if (this.stack.includes(id)) {
      const path = [...this.stack.slice(this.stack.indexOf(id)), id].map((x) => this.items.get(x)?.name ?? x);
      this.note(this.stack[0], { code: "cycle", path });
      return 0;
    }
    const lines = this.linesBy.get(id) ?? [];
    let cost = 0;
    if (lines.length === 0) {
      // Raw ingredient (or a prep/dish with no recipe yet).
      const pc = Number(it.purchaseUnitCost) || 0;
      let y = it.yieldPct == null ? 100 : Number(it.yieldPct);
      if (!(y > 0 && y <= 100)) { this.note(id, { code: "bad_yield_pct", itemId: id }); y = 100; }
      if (it.kind === "raw" && pc <= 0) this.note(id, { code: "no_cost", itemId: id });
      cost = pc / (y / 100);
    } else {
      const h = this.headers.get(id);
      if (h && !(h.yieldQty > 0)) this.note(id, { code: "zero_yield", itemId: id });
      this.stack.push(id);
      for (const l of lines) cost += (Number(l.qty) || 0) * this.unitCost(l.componentId);
      this.stack.pop();
    }
    if (!Number.isFinite(cost)) cost = 0;
    this.memo.set(id, cost);
    return cost;
  }

  result(id: string): CostResult {
    const it = this.items.get(id);
    const unitCost = this.unitCost(id);
    const h = this.headers.get(id);
    const lines = this.linesBy.get(id) ?? [];
    const yieldQty = h?.yieldQty && h.yieldQty > 0 ? h.yieldQty : 1;
    let inputQtyBase: number | null = null;
    if (it && lines.length) {
      const base = this.unit(it.baseUnitId);
      let sum = 0, ok = true;
      for (const l of lines) {
        const c = this.items.get(l.componentId);
        const v = convertForItem(l.qty * yieldQty, this.unit(c?.baseUnitId), base, c, this.units);
        if (v == null) { ok = false; break; }
        sum += v;
      }
      inputQtyBase = ok ? sum : null;
    }
    return {
      itemId: id, kind: it?.kind ?? "raw", unitCost, batchCost: unitCost * yieldQty, yieldQty, inputQtyBase,
      hasRecipe: lines.length > 0, issues: this.issues.get(id) ?? [],
    };
  }

  /**
   * Line-by-line cost of a recipe. `scale` = how many base units of the parent
   * are being made (default: its yield, i.e. the batch / portion as written).
   * Prep components expand into their own lines scaled to the quantity used.
   */
  breakdown(id: string, scale?: number, depth = 0, seen: string[] = []): Breakdown[] {
    if (depth > 12 || seen.includes(id)) return [];
    const h = this.headers.get(id);
    const s = scale ?? (h?.yieldQty && h.yieldQty > 0 ? h.yieldQty : 1);
    return (this.linesBy.get(id) ?? []).map((l) => {
      const c = this.items.get(l.componentId);
      const baseQty = l.qty * s;
      const cBase = this.unit(c?.baseUnitId);
      const entryUnit = this.unit(l.entryUnitId);
      const shown = entryUnit && depth === 0 && scale === undefined ? convertForItem(baseQty, cBase, entryUnit, c, this.units) : null;
      const uc = this.unitCost(l.componentId);
      const hasKids = (this.linesBy.get(l.componentId) ?? []).length > 0;
      return {
        componentId: l.componentId, name: c?.name ?? "(deleted item)", kind: c?.kind ?? "missing",
        qty: shown ?? baseQty, unitAbbr: (shown != null ? entryUnit?.abbr : cBase?.abbr) ?? "",
        baseQty, baseUnitAbbr: cBase?.abbr ?? "", unitCost: uc, lineCost: baseQty * uc,
        children: hasKids ? this.breakdown(l.componentId, baseQty, depth + 1, [...seen, id]) : undefined,
      };
    });
  }
}

// ---------- save-time helpers ----------

/** Returns the dependency path if making `parentId` use `componentIds` would create a loop, else null. */
export function findCycle(parentId: string, componentIds: string[], lines: RecipeLine[], nameOf: (id: string) => string = (x) => x): string[] | null {
  const graph = new Map<string, string[]>();
  for (const l of lines) if (l.parentId !== parentId) graph.set(l.parentId, [...(graph.get(l.parentId) ?? []), l.componentId]);
  const dfs = (n: string, path: string[], visited: Set<string>): string[] | null => {
    if (n === parentId) return [...path, n];
    if (visited.has(n)) return null;
    visited.add(n);
    for (const m of graph.get(n) ?? []) {
      const r = dfs(m, [...path, n], visited);
      if (r) return r;
    }
    return null;
  };
  for (const c of componentIds) {
    const r = dfs(c, [parentId], new Set());
    if (r) return r.map(nameOf);
  }
  return null;
}

export type EntryLine = { componentId: string; entryQty: number; entryUnitId: string | null };
export type NormaliseError = { index: number; message: string };

/**
 * Turn what the cook typed (qty + unit per line, plus batch yield) into stored
 * lines (component base units per 1 base unit of output).
 */
export function normaliseLines(
  parentId: string, yieldQty: number, entries: EntryLine[],
  items: Map<string, CostItem>, units: Map<string, CostUnit>,
): { lines: RecipeLine[]; errors: NormaliseError[] } {
  const errors: NormaliseError[] = [];
  if (!(yieldQty > 0)) return { lines: [], errors: [{ index: -1, message: "Yield must be greater than 0" }] };
  const lines: RecipeLine[] = [];
  entries.forEach((e, index) => {
    if (!e.componentId) return;
    const q = Number(e.entryQty);
    if (!(q > 0)) { errors.push({ index, message: "Quantity must be greater than 0" }); return; }
    if (e.componentId === parentId) { errors.push({ index, message: "A recipe cannot contain itself" }); return; }
    const c = items.get(e.componentId);
    if (!c) { errors.push({ index, message: "Item not found" }); return; }
    const to = c.baseUnitId ? units.get(c.baseUnitId) : undefined;
    const from = e.entryUnitId ? units.get(e.entryUnitId) : to;
    const base = convertForItem(q, from, to, c, units);
    if (base == null) {
      errors.push({ index, message: `${c.name} is measured in ${to?.abbr ?? "its own unit"} — "${from?.abbr}" can't be converted. Set its pack size (1 ${to?.abbr ?? "unit"} = ? ${from?.abbr}) in Ingredients.` });
      return;
    }
    lines.push({ parentId, componentId: e.componentId, qty: base / yieldQty, entryQty: q, entryUnitId: from?.id ?? null, sortOrder: index });
  });
  return { lines, errors };
}

export const foodCostPct = (foodCost: number, sellingPriceExGst: number) =>
  sellingPriceExGst > 0 ? (foodCost / sellingPriceExGst) * 100 : null;
