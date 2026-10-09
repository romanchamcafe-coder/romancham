"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateIngredientCosting } from "@/server/actions/ingredients";
import { toast } from "@/lib/toast";
import type { IngredientCostRow } from "@/server/queries/ingredient-costs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Download, Search, Pencil, Check, X } from "lucide-react";

export type PackUnit = { id: string; abbr: string; family: "mass" | "volume"; factor: number };
type Edit = { id: string; yieldPct: string; packQty: string; packUnitId: string };

const money = (n: number | null, dp = 2) => (n == null ? "—" : "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp }));
const small = (n: number | null) => (n == null ? "—" : n >= 1 ? money(n, 2) : money(n, 4));
const LARGE: Record<string, string> = { g: "kg", ml: "L" };
// Needs attention: no price yet, or no gram/ml conversion (bought per qty/packet without a pack size).
const needs = (r: IngredientCostRow) => !r.hasCost || (r.measure !== "g" && r.measure !== "ml");

export function CostTable({ rows, categories, packUnits, canEdit = false }: { rows: IngredientCostRow[]; categories: { id: string; name: string }[]; packUnits: PackUnit[]; canEdit?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ed, setEd] = useState<Edit | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "raw" | "prep" | "missing">("all");
  const cat = new Map(categories.map((c) => [c.id, c.name]));

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) =>
      (kind === "all" || (kind === "missing" ? needs(r) : r.kind === kind)) &&
      (!s || r.name.toLowerCase().includes(s) || (cat.get(r.categoryId ?? "") ?? "").toLowerCase().includes(s)));
  }, [rows, q, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const missing = rows.filter(needs).length;
  const pu = new Map(packUnits.map((u) => [u.id, u]));
  const gramUnit = packUnits.find((u) => u.family === "mass" && u.factor === 1)?.id ?? packUnits[0]?.id ?? "";

  function startEdit(r: IngredientCostRow) {
    setEd({ id: r.id, yieldPct: String(r.yieldPct), packQty: r.packQty != null ? String(r.packQty) : "", packUnitId: r.packUnitId ?? gramUnit });
  }
  // Live preview of per-g/ml with the values being typed.
  function preview(r: IngredientCostRow, e: Edit): { per: number; m: "g" | "ml" } | null {
    const y = Number(e.yieldPct); if (!(y > 0 && y <= 100) || !(r.purchaseCost > 0)) return null;
    const usable = r.purchaseCost / (y / 100);
    const qn = Number(e.packQty), u = pu.get(e.packUnitId);
    if (qn > 0 && u) return { per: usable / (qn * u.factor), m: u.family === "mass" ? "g" : "ml" };
    if ((r.measure === "g" || r.measure === "ml") && r.perSmall != null && r.usableCost > 0) return { per: (r.perSmall / r.usableCost) * usable, m: r.measure };
    return null;
  }
  function save() {
    if (!ed) return;
    start(async () => {
      const res = await updateIngredientCosting(ed.id, { yieldPct: ed.yieldPct, packQty: ed.packQty, packUnitId: ed.packUnitId });
      if (res.error) toast(res.error, "error");
      else { toast("Saved — recipes and menu costs updated"); setEd(null); router.refresh(); }
    });
  }

  function exportCsv() {
    const head = ["Item", "Type", "Category", "Base unit", "Pack size", "Purchase cost / base unit", "Usable yield %", "Usable cost / base unit", "Per g/ml/pc", "Per kg/L/dozen", "Measure"];
    const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const r2 = (n: number | null, d = 4) => (n == null ? "" : String(Math.round(n * 10 ** d) / 10 ** d));
    const lines = [head, ...rows.map((r) => [r.name, r.kind, cat.get(r.categoryId ?? "") ?? "", r.baseUnit, r.packNote ?? "", r2(r.purchaseCost), r.yieldPct, r2(r.usableCost), r2(r.perSmall), r2(r.perLarge, 2), r.measure ?? ""])];
    const blob = new Blob([lines.map((l) => l.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "romancham-ingredient-costs.csv"; a.click();
  }

  const raw = rows.filter((r) => r.kind === "raw").length;
  const card = (label: string, n: number, strong = false) => (
    <div className={cn("rounded-lg border px-4 py-2", strong && "bg-primary/5")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("tabular-nums", strong ? "text-2xl font-bold text-primary" : "text-lg font-semibold")}>{n}</p>
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {card("Total items", rows.length, true)}
        {card("Raw ingredients", raw)}
        {card("Preps", rows.length - raw)}
        {card("Cost per g / kg ready", rows.length - missing)}
        {card("Needs attention", missing)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item or category…" className="h-9 pl-8" />
        </div>
        {([["all", "All"], ["raw", "Raw ingredients"], ["prep", "Preps"], ["missing", `Needs attention (${missing})`]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setKind(k)}
            className={cn("rounded-md px-3 py-1.5 text-sm", kind === k ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted")}>{l}</button>
        ))}
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-2">Item</th><th className="p-2">Category</th><th className="p-2">Bought in</th>
              <th className="p-2 text-right">Purchase cost</th><th className="p-2 text-right">Usable %</th>
              <th className="p-2 text-right">Cost per g / ml</th><th className="p-2 text-right">Cost per kg / L</th><th className="w-20 p-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => ed?.id === r.id ? (
              <tr key={r.id} className="border-b bg-primary/5 align-top">
                <td className="p-2 font-medium">{r.name}</td>
                <td className="p-2 text-muted-foreground">{cat.get(r.categoryId ?? "") ?? "—"}</td>
                <td className="p-2" colSpan={2}>
                  <div className="text-xs text-muted-foreground">Pack size (only if bought per {r.baseUnit} but used in g/ml)</div>
                  <div className="mt-1 flex items-center gap-1">
                    <span className="text-xs">1 {r.baseUnit} =</span>
                    <Input type="number" min="0" step="0.01" value={ed.packQty} onChange={(e) => setEd({ ...ed, packQty: e.target.value })} className="h-8 w-24" placeholder="e.g. 400" autoFocus />
                    <select value={ed.packUnitId} onChange={(e) => setEd({ ...ed, packUnitId: e.target.value })} className="h-8 rounded-md border border-input bg-background px-1 text-sm" aria-label="Pack unit">
                      {packUnits.map((u) => <option key={u.id} value={u.id}>{u.abbr}</option>)}
                    </select>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Purchase cost {r.purchaseCost > 0 ? `${money(r.purchaseCost)}/${r.baseUnit}` : "— (no purchase yet)"}</div>
                </td>
                <td className="p-2 text-right">
                  <div className="text-xs text-muted-foreground">Usable %</div>
                  <Input type="number" min="1" max="100" step="0.1" value={ed.yieldPct} onChange={(e) => setEd({ ...ed, yieldPct: e.target.value })} className="ml-auto mt-1 h-8 w-20 text-right" />
                </td>
                {(() => { const p = preview(r, ed); return <>
                  <td className="p-2 text-right font-medium tabular-nums">{p ? `${small(p.per)}/${p.m}` : "—"}<div className="text-xs font-normal text-muted-foreground">preview</div></td>
                  <td className="p-2 text-right font-semibold tabular-nums">{p ? `${money(p.per * 1000)}/${LARGE[p.m]}` : "—"}</td>
                </>; })()}
                <td className="p-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" onClick={save} disabled={pending} aria-label="Save"><Check className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => setEd(null)} disabled={pending} aria-label="Cancel"><X className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={r.id} className="border-b">
                <td className="p-2 font-medium">{r.name} {r.kind === "prep" && <Badge tone="amber" className="ml-1">prep</Badge>}</td>
                <td className="p-2 text-muted-foreground">{cat.get(r.categoryId ?? "") ?? "—"}</td>
                <td className="p-2">{r.baseUnit}{r.packNote && <div className="text-xs text-muted-foreground">{r.packNote}</div>}</td>
                <td className="p-2 text-right tabular-nums">{r.purchaseCost > 0 ? `${money(r.purchaseCost)}/${r.baseUnit}` : <span className="text-amber-600">{r.kind === "prep" ? "no recipe" : "no purchase yet"}</span>}</td>
                <td className={cn("p-2 text-right tabular-nums", r.yieldPct < 100 && "text-amber-600")}>{r.kind === "prep" ? "—" : `${r.yieldPct}%`}</td>
                <td className="p-2 text-right font-medium tabular-nums">
                  {!r.hasCost ? "—" : r.measure === "g" || r.measure === "ml" ? `${small(r.perSmall)}/${r.measure}`
                    : <span className="text-xs font-normal text-amber-600">set pack size (1 {r.baseUnit} = ? g)</span>}
                </td>
                <td className="p-2 text-right font-semibold tabular-nums">{r.perLarge != null && r.hasCost && (r.measure === "g" || r.measure === "ml") ? `${money(r.perLarge)}/${LARGE[r.measure]}` : "—"}</td>
                <td className="p-2 text-right">
                  {!canEdit ? null : r.kind === "raw"
                    ? <button type="button" onClick={() => startEdit(r)} disabled={!!ed} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30" aria-label={`Edit ${r.name}`}><Pencil className="h-4 w-4" /></button>
                    : <a href="/recipes?tab=prep" className="text-xs text-primary underline">recipe</a>}
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No items match.</td></tr>}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted-foreground">
        Purchase cost = latest purchase price per unit bought. Per g/kg uses the <b>usable</b> cost (after trimming yield %) — the same numbers your recipes use.
        Items bought per <b>qty/packet</b> need a <b>pack size</b> (e.g. “1 qty = 400 gms”) to get the per-gram cost{canEdit ? " — click ✏️ on the row to set it." : " — ask the Owner/Admin to set it."}
      </p>
    </div>
  );
}
