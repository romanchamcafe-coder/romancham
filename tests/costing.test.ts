// Run:  node --experimental-strip-types --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { CostBook, convertQty, findCycle, normaliseLines, foodCostPct, type CostItem, type CostUnit, type RecipeHeader, type RecipeLine } from "../lib/costing.ts";
import { computePricing } from "../lib/menu-pricing.ts";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

// ---- fixture: units ----
const U: Record<string, CostUnit> = {
  g: { id: "u_g", abbr: "gms" }, kg: { id: "u_kg", abbr: "kg" }, ml: { id: "u_ml", abbr: "ml" },
  l: { id: "u_l", abbr: "lts" }, pc: { id: "u_pc", abbr: "pcs" }, dz: { id: "u_dz", abbr: "dz" },
};
const units = Object.values(U);

// ---- fixture: raw ingredients (cost per base unit) ----
const raw = (id: string, name: string, unit: CostUnit, cost: number, yieldPct = 100): CostItem =>
  ({ id, name, kind: "raw", baseUnitId: unit.id, purchaseUnitCost: cost, yieldPct });
const RAW: CostItem[] = [
  raw("epi", "Epigamia Yogurt", U.g, 0.30),      // ₹300/kg
  raw("cream", "Elle & Vire Cream", U.ml, 0.50), // ₹500/L
  raw("honey", "Honey", U.g, 0.80),
  raw("mulb", "Mulberry", U.g, 0.40),
  raw("sugar", "Sugar", U.g, 0.05),
  raw("lemon", "Lemon", U.pc, 6),
  raw("oats", "Rolled oats", U.g, 0.20),
  raw("alm", "Almonds", U.g, 1.00),
  raw("sun", "Sunflower seeds", U.g, 0.40),
  raw("pump", "Pumpkin seeds", U.g, 0.90),
  raw("flax", "Flax", U.g, 0.25),
  raw("chia", "Chia seeds", U.g, 0.60),
  raw("cin", "Cinnamon", U.g, 1.50),
  raw("dragon", "Dragon fruit", U.g, 0.25, 80),   // 80 % usable after peeling
  raw("pom", "Pomegranate", U.g, 0.20, 50),       // 50 % usable arils
];
const PREP = (id: string, name: string, unit: CostUnit): CostItem => ({ id, name, kind: "prep", baseUnitId: unit.id });
const DISH = (id: string, name: string): CostItem => ({ id, name, kind: "dish", baseUnitId: U.pc.id });

function build(extra: { items?: CostItem[]; headers?: RecipeHeader[]; entries?: Record<string, { y: number; lines: [string, number, CostUnit][] }> } = {}) {
  const items = [...RAW, PREP("wy", "Whipped Yoghurt", U.g), PREP("mc", "Mulberry Compote", U.g), PREP("gr", "Granola", U.g), DISH("bowl", "Whipped Yoghurt Bowl"), ...(extra.items ?? [])];
  const im = new Map(items.map((i) => [i.id, i])), um = new Map(units.map((u) => [u.id, u]));
  const recipes: Record<string, { y: number; lines: [string, number, CostUnit][] }> = {
    wy: { y: 520, lines: [["epi", 400, U.g], ["cream", 100, U.ml], ["honey", 20, U.g]] },
    mc: { y: 850, lines: [["mulb", 1, U.kg], ["sugar", 80, U.g], ["lemon", 1, U.pc]] },
    gr: { y: 512, lines: [["oats", 280, U.g], ["alm", 70, U.g], ["sun", 40, U.g], ["pump", 35, U.g], ["flax", 25, U.g], ["chia", 15, U.g], ["honey", 45, U.g], ["cin", 2, U.g]] },
    bowl: { y: 1, lines: [["wy", 100, U.g], ["mc", 40, U.g], ["gr", 40, U.g], ["honey", 6, U.g], ["lemon", 0.5, U.pc], ["dragon", 50, U.g], ["pom", 30, U.g]] },
    ...(extra.entries ?? {}),
  };
  const headers: RecipeHeader[] = Object.entries(recipes).map(([id, r]) => ({ itemId: id, type: id === "bowl" ? "dish" : "prep", yieldQty: r.y }));
  const lines: RecipeLine[] = [];
  for (const [id, r] of Object.entries(recipes)) {
    const n = normaliseLines(id, r.y, r.lines.map(([c, q, u]) => ({ componentId: c, entryQty: q, entryUnitId: u.id })), im, um);
    assert.deepEqual(n.errors, []);
    lines.push(...n.lines);
  }
  return { book: new CostBook({ items, units, headers: [...headers, ...(extra.headers ?? [])], lines }), items, lines, im, um };
}

// Expected by hand
const WY_BATCH = 400 * 0.30 + 100 * 0.50 + 20 * 0.80;                 // 120 + 50 + 16 = 186
const WY_G = WY_BATCH / 520;                                          // 0.357692…
const MC_BATCH = 1000 * 0.40 + 80 * 0.05 + 1 * 6;                     // 400 + 4 + 6 = 410
const MC_G = MC_BATCH / 850;                                          // 0.482352…
const GR_BATCH = 280 * .2 + 70 * 1 + 40 * .4 + 35 * .9 + 25 * .25 + 15 * .6 + 45 * .8 + 2 * 1.5; // 56+70+16+31.5+6.25+9+36+3 = 227.75
const GR_G = GR_BATCH / 512;
const BOWL = 100 * WY_G + 40 * MC_G + 40 * GR_G + 6 * 0.8 + 0.5 * 6 + 50 * (0.25 / 0.8) + 30 * (0.20 / 0.5);

test("1. raw ingredient costing (incl. usable yield)", () => {
  const { book } = build();
  close(book.unitCost("epi"), 0.30);
  close(book.unitCost("dragon"), 0.25 / 0.8);  // ₹0.3125 per usable g
  close(book.unitCost("pom"), 0.40);
});

test("2. prep recipe costing — Whipped Yoghurt", () => {
  const { book } = build();
  const r = book.result("wy");
  close(r.batchCost, WY_BATCH); close(r.unitCost, WY_G);
  assert.equal(r.hasRecipe, true);
});

test("3. prep yield costing — compote uses final 850 g, not 1081 g input", () => {
  const { book } = build();
  const r = book.result("mc");
  close(r.unitCost, MC_G);
  close(r.batchCost, MC_BATCH);
  assert.equal(r.inputQtyBase, null); // lemon (pcs) can't be summed with grams → input total not comparable
  const g = book.result("gr");
  close(g.inputQtyBase!, 512);          // granola inputs sum 512 g = yield 512 g
});

test("4. final dish using only raw ingredients", () => {
  const { book } = build({ items: [DISH("lem", "Lemonade")], entries: { lem: { y: 1, lines: [["lemon", 2, U.pc], ["sugar", 30, U.g]] } } });
  close(book.unitCost("lem"), 2 * 6 + 30 * 0.05);
});

test("5. final dish using only prep recipes", () => {
  const { book } = build({ items: [DISH("par", "Fruit Parfait")], entries: { par: { y: 1, lines: [["wy", 150, U.g], ["gr", 30, U.g]] } } });
  close(book.unitCost("par"), 150 * WY_G + 30 * GR_G);
});

test("6. final dish using both — Whipped Yoghurt Bowl end-to-end", () => {
  const { book } = build();
  close(book.unitCost("bowl"), BOWL);
  const bd = book.breakdown("bowl");
  const wy = bd.find((b) => b.componentId === "wy")!;
  close(wy.lineCost, 100 * WY_G);
  assert.equal(wy.children!.length, 3);              // traceability: Epigamia, cream, honey
  close(wy.children!.reduce((s, c) => s + c.lineCost, 0), 100 * WY_G);
  close(wy.children!.find((c) => c.componentId === "epi")!.baseQty, 400 * 100 / 520);
  close(bd.reduce((s, b) => s + b.lineCost, 0), BOWL);
});

test("7. nested preps (prep inside prep)", () => {
  const { book } = build({
    items: [PREP("yp", "Yoghurt Parfait Base", U.g)],
    entries: { yp: { y: 300, lines: [["wy", 200, U.g], ["mc", 120, U.g]] } },
  });
  close(book.unitCost("yp"), (200 * WY_G + 120 * MC_G) / 300);
});

test("8. ingredient price change propagates raw → prep → dish", () => {
  const a = build().book.unitCost("bowl");
  const { items, lines } = build();
  const changed = items.map((i) => (i.id === "epi" ? { ...i, purchaseUnitCost: 0.45 } : i));
  const b = new CostBook({ items: changed, units, headers: [{ itemId: "wy", type: "prep", yieldQty: 520 }, { itemId: "mc", type: "prep", yieldQty: 850 }, { itemId: "gr", type: "prep", yieldQty: 512 }, { itemId: "bowl", type: "dish", yieldQty: 1 }], lines }).unitCost("bowl");
  close(b - a, 100 * (400 * 0.15) / 520);
});

test("9. yield change propagates (less compote yield → dearer per g → dearer bowl)", () => {
  const base = build().book;
  const lowYield = build({ entries: { mc: { y: 700, lines: [["mulb", 1, U.kg], ["sugar", 80, U.g], ["lemon", 1, U.pc]] } } }).book;
  close(lowYield.unitCost("mc"), MC_BATCH / 700);
  close(lowYield.unitCost("bowl") - base.unitCost("bowl"), 40 * (MC_BATCH / 700 - MC_G));
});

test("10. circular dependency is detected and blocked", () => {
  const { lines } = build({ items: [PREP("a", "A", U.g), PREP("b", "B", U.g), PREP("c", "C", U.g)], entries: {
    a: { y: 100, lines: [["b", 50, U.g]] }, b: { y: 100, lines: [["c", 50, U.g]] }, c: { y: 100, lines: [["sugar", 50, U.g]] },
  } });
  const cyc = findCycle("c", ["a"], lines, (x) => x.toUpperCase());
  assert.deepEqual(cyc, ["C", "A", "B", "C"]);
  assert.equal(findCycle("c", ["sugar"], lines), null);
  // the engine itself never loops forever even if bad data exists
  const items: CostItem[] = [PREP("x", "X", U.g), PREP("y", "Y", U.g)];
  const book = new CostBook({ items, units, headers: [], lines: [{ parentId: "x", componentId: "y", qty: 1 }, { parentId: "y", componentId: "x", qty: 1 }] });
  assert.equal(book.unitCost("x"), 0);
  assert.ok(book.result("x").issues.some((i) => i.code === "cycle"));
});

test("11. zero / invalid yield protection", () => {
  const { im, um } = build();
  const n = normaliseLines("wy", 0, [{ componentId: "epi", entryQty: 100, entryUnitId: U.g.id }], im, um);
  assert.equal(n.lines.length, 0);
  assert.match(n.errors[0].message, /Yield/);
  const bad = new CostBook({ items: [raw("x", "X", U.g, 1, 0)], units, headers: [], lines: [] });
  close(bad.unitCost("x"), 1); // invalid yield % falls back to 100 %
  assert.ok(bad.result("x").issues.some((i) => i.code === "bad_yield_pct"));
});

test("12. unit conversion and mismatch errors", () => {
  close(convertQty(1, U.kg, U.g)!, 1000);
  close(convertQty(250, U.ml, U.l)!, 0.25);
  close(convertQty(1, U.dz, U.pc)!, 12);
  assert.equal(convertQty(1, U.ml, U.g), null);
  const { im, um } = build();
  const n = normaliseLines("wy", 520, [{ componentId: "epi", entryQty: 100, entryUnitId: U.ml.id }], im, um);
  assert.equal(n.lines.length, 0);
  assert.match(n.errors[0].message, /can't be converted/);
});

test("13. multiple final dishes share the same prep (no duplication)", () => {
  const { book, lines } = build({ items: [DISH("par", "Fruit Parfait")], entries: { par: { y: 1, lines: [["wy", 150, U.g]] } } });
  assert.equal(lines.filter((l) => l.parentId === "wy").length, 3);         // stored once
  assert.equal(lines.filter((l) => l.componentId === "wy").length, 2);      // referenced twice
  close(book.unitCost("par"), 150 * WY_G);
});

test("14. food cost %", () => {
  const { book } = build();
  const pct = foodCostPct(book.unitCost("bowl"), 395)!;
  close(pct, (BOWL / 395) * 100);
  assert.equal(foodCostPct(10, 0), null);
});

test("15. menu engineering integration — pricing built on the engine's food cost", () => {
  const { book } = build();
  const fc = book.unitCost("bowl");
  const r = computePricing({ recipeCost: fc, packaging: 0, wastage: 5, labor: 20, utility: 5, overhead: 10, marketing: 5, commission: 0, targetProfit: 40, gst: 5 });
  close(r.dineCost, fc * 1.05 + fc * 0.40);
  close(r.dinePrice, r.dineCost * 1.4 * 1.05);
});

test("print the Whipped Yoghurt Bowl calculation", () => {
  const { book } = build();
  const out: string[] = [];
  for (const id of ["wy", "mc", "gr"]) {
    const r = book.result(id);
    out.push(`${book.item(id)!.name}: batch ₹${r.batchCost.toFixed(2)} ÷ ${r.yieldQty} g = ₹${r.unitCost.toFixed(4)}/g`);
  }
  for (const b of book.breakdown("bowl")) out.push(`  ${b.name.padEnd(22)} ${String(+b.qty.toFixed(2)).padStart(6)} ${b.unitAbbr.padEnd(4)} × ₹${b.unitCost.toFixed(4)} = ₹${b.lineCost.toFixed(2)}`);
  out.push(`  FOOD COST ₹${book.unitCost("bowl").toFixed(2)}  ·  at ₹395 → ${foodCostPct(book.unitCost("bowl"), 395)!.toFixed(1)}%`);
  console.log(out.join("\n"));
});
