"use client";
import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { Download, Upload } from "lucide-react";
import { importRecipes, type RawRecipeRow } from "@/server/actions/recipes";

type Comp = { name: string; qty: number; cost: number };
type Recipe = { name: string; components: Comp[]; cost: number };

const HEADERS = ["Sales Item", "Component", "Qty", "Unit Cost", "Line Cost", "Recipe Cost"];
const n2 = (n: number) => (Math.round(n * 100) / 100).toString();

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function RecipesIO({ recipes }: { recipes: Recipe[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const exportCsv = () => {
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const lines = [HEADERS.join(",")];
    for (const r of recipes) {
      if (r.components.length === 0) {
        lines.push([r.name, "", "", "", "", n2(r.cost)].map((v) => esc(String(v))).join(","));
        continue;
      }
      for (const c of r.components) {
        lines.push([r.name, c.name, n2(c.qty), n2(c.cost), n2(c.qty * c.cost), n2(r.cost)]
          .map((v) => esc(String(v))).join(","));
      }
    }
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "recipes.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const grid = parseCsv(String(reader.result || "")).filter((r) => r.some((c) => c.trim()));
      if (grid.length < 2) { toast("The file has no data rows", "error"); if (fileRef.current) fileRef.current.value = ""; return; }
      const header = grid[0].map((h) => h.trim().toLowerCase());
      const idx = (...names: string[]) => header.findIndex((h) => names.includes(h));
      const iSales = idx("sales item", "item", "product", "sales_item");
      const iComp = idx("component", "components", "purchase item", "ingredient");
      const iQty = idx("qty", "quantity", "qty / portion", "qty/portion");
      if (iSales < 0 || iComp < 0 || iQty < 0) {
        toast("CSV needs Sales Item, Component and Qty columns. Tip: export first for the right format.", "error");
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      const at = (r: string[], i: number) => (i >= 0 ? (r[i] || "").trim() : "");
      const rows: RawRecipeRow[] = grid.slice(1)
        .map((r) => ({ salesItem: at(r, iSales), component: at(r, iComp), qty: at(r, iQty) }))
        .filter((r) => r.salesItem);

      if (rows.length === 0) { toast("No recipe rows found in the file", "error"); if (fileRef.current) fileRef.current.value = ""; return; }

      start(async () => {
        const res = await importRecipes(rows);
        if (res.error) toast(res.error, "error");
        else {
          const rc = res.recipes ?? 0, ln = res.lines ?? 0, sk = res.skipped ?? 0;
          toast(`Updated ${rc} recipe${rc === 1 ? "" : "s"} (${ln} component${ln === 1 ? "" : "s"})${sk ? `, skipped ${sk} unknown/blank` : ""}`);
          router.refresh();
        }
        if (fileRef.current) fileRef.current.value = "";
      });
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={exportCsv} disabled={recipes.length === 0}>
        <Download className="h-4 w-4" /> Export CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={pending}>
        <Upload className="h-4 w-4" /> Import CSV
      </Button>
      <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={onImport} aria-hidden />
      <span className="text-xs text-muted-foreground">
        Detailed breakup: one row per component (Sales Item, Component, Qty). Import replaces each listed item&apos;s recipe; unit/line/recipe cost are recalculated automatically.
      </span>
    </div>
  );
}
