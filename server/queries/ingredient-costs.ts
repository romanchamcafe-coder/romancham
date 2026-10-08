import { loadCostBook } from "@/server/queries/costing";
import { convertForItem, unitInfo, type CostUnit } from "@/lib/costing";

export type IngredientCostRow = {
  id: string; name: string; kind: "raw" | "prep"; categoryId: string | null;
  baseUnit: string; packNote: string | null;
  packQty: number | null; packUnitId: string | null;
  purchaseCost: number;          // per base unit, as bought (raw) / cost per base unit (prep)
  yieldPct: number;
  usableCost: number;            // per base unit after yield %
  measure: "g" | "ml" | "pc" | null;
  perSmall: number | null;       // ₹ per g / ml / piece
  perLarge: number | null;       // ₹ per kg / L / dozen
  hasCost: boolean;
};

// Cost per gram & per kg for every raw ingredient and prep — straight from the
// costing engine (same numbers recipes use).
export async function getIngredientCosts(orgId: string): Promise<IngredientCostRow[]> {
  const { data, book } = await loadCostBook(orgId);
  const units = new Map(data.units.map((u) => [u.id, u]));
  const pick = (family: string) => data.units.find((u) => unitInfo(u).family === family && unitInfo(u).factor === 1);
  const gram = pick("mass"), ml = pick("volume"), pc = pick("count");

  const rows: IngredientCostRow[] = [];
  for (const it of data.items) {
    if (!it.isActive) continue;
    const isRaw = it.materialType === "purchase" || it.materialType === "both";
    const isPrep = it.kind === "prep";
    if (!isRaw && !isPrep) continue;
    const base = it.baseUnitId ? units.get(it.baseUnitId) : undefined;
    const usable = book.unitCost(it.id);
    let measure: IngredientCostRow["measure"] = null, perSmall: number | null = null;
    const tryUnit = (u: CostUnit | undefined, m: "g" | "ml" | "pc") => {
      if (!u || perSmall != null) return;
      const baseQtyPerOne = convertForItem(1, u, base, it, units);
      if (baseQtyPerOne != null) { perSmall = usable * baseQtyPerOne; measure = m; }
    };
    tryUnit(gram, "g"); tryUnit(ml, "ml"); tryUnit(pc, "pc");
    const content = it.contentUnitId ? units.get(it.contentUnitId) : undefined;
    rows.push({
      id: it.id, name: it.name, kind: isPrep ? "prep" : "raw", categoryId: it.categoryId,
      baseUnit: base?.abbr ?? "—",
      packNote: it.contentQty && content ? `1 ${base?.abbr ?? "unit"} = ${it.contentQty} ${content.abbr}` : null,
      packQty: it.contentQty ?? null, packUnitId: it.contentUnitId ?? null,
      purchaseCost: isPrep ? usable : Number(it.purchaseUnitCost) || 0,
      yieldPct: it.yieldPct ?? 100,
      usableCost: usable, measure, perSmall,
      perLarge: perSmall == null ? null : perSmall * (measure === "pc" ? 12 : 1000),
      hasCost: usable > 0,
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
