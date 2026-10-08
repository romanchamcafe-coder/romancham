"use client";
import { useMemo, useState } from "react";
import type { IngredientCostRow } from "@/server/queries/ingredient-costs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Download, Search } from "lucide-react";

const money = (n: number | null, dp = 2) => (n == null ? "—" : "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp }));
const small = (n: number | null) => (n == null ? "—" : n >= 1 ? money(n, 2) : money(n, 4));
const LARGE: Record<string, string> = { g: "kg", ml: "L", pc: "dozen" };

export function CostTable({ rows, categories }: { rows: IngredientCostRow[]; categories: { id: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "raw" | "prep" | "missing">("all");
  const cat = new Map(categories.map((c) => [c.id, c.name]));

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) =>
      (kind === "all" || (kind === "missing" ? !r.hasCost || r.perSmall == null : r.kind === kind)) &&
      (!s || r.name.toLowerCase().includes(s) || (cat.get(r.categoryId ?? "") ?? "").toLowerCase().includes(s)));
  }, [rows, q, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const missing = rows.filter((r) => !r.hasCost || r.perSmall == null).length;

  function exportCsv() {
    const head = ["Item", "Type", "Category", "Base unit", "Pack size", "Purchase cost / base unit", "Usable yield %", "Usable cost / base unit", "Per g/ml/pc", "Per kg/L/dozen", "Measure"];
    const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const r2 = (n: number | null, d = 4) => (n == null ? "" : String(Math.round(n * 10 ** d) / 10 ** d));
    const lines = [head, ...rows.map((r) => [r.name, r.kind, cat.get(r.categoryId ?? "") ?? "", r.baseUnit, r.packNote ?? "", r2(r.purchaseCost), r.yieldPct, r2(r.usableCost), r2(r.perSmall), r2(r.perLarge, 2), r.measure ?? ""])];
    const blob = new Blob([lines.map((l) => l.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "romancham-ingredient-costs.csv"; a.click();
  }

  return (
    <div className="space-y-3">
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
              <th className="p-2 text-right">Cost per g / ml</th><th className="p-2 text-right">Cost per kg / L</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-2 font-medium">{r.name} {r.kind === "prep" && <Badge tone="amber" className="ml-1">prep</Badge>}</td>
                <td className="p-2 text-muted-foreground">{cat.get(r.categoryId ?? "") ?? "—"}</td>
                <td className="p-2">{r.baseUnit}{r.packNote && <div className="text-xs text-muted-foreground">{r.packNote}</div>}</td>
                <td className="p-2 text-right tabular-nums">{r.purchaseCost > 0 ? `${money(r.purchaseCost)}/${r.baseUnit}` : <span className="text-amber-600">{r.kind === "prep" ? "no recipe" : "no purchase yet"}</span>}</td>
                <td className={cn("p-2 text-right tabular-nums", r.yieldPct < 100 && "text-amber-600")}>{r.kind === "prep" ? "—" : `${r.yieldPct}%`}</td>
                <td className="p-2 text-right font-medium tabular-nums">
                  {r.perSmall != null && r.hasCost ? `${small(r.perSmall)}/${r.measure}` : r.hasCost ? <span className="text-xs text-amber-600">set pack size</span> : "—"}
                </td>
                <td className="p-2 text-right font-semibold tabular-nums">{r.perLarge != null && r.hasCost ? `${money(r.perLarge)}/${LARGE[r.measure ?? "g"]}` : "—"}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No items match.</td></tr>}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted-foreground">
        Purchase cost = latest purchase price per unit bought. Per g/kg uses the <b>usable</b> cost (after trimming yield %) — the same numbers your recipes use.
        Items bought per <b>qty/packet</b> need a <b>pack size</b> (Ingredients → edit → “1 qty = 400 gms”) to show a per-gram cost.
      </p>
    </div>
  );
}
