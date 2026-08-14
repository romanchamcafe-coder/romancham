"use client";
import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { Download, Upload } from "lucide-react";
import { computePricing } from "@/lib/menu-pricing";
import { importMenuPricing, type RawMenuRow } from "@/server/actions/menu";
import type { MenuItem } from "@/server/queries/menu";

const HEADERS = ["Sales Item", "Recipe Cost", "Packaging", "Wastage %", "Labor", "Utility", "Overhead", "Marketing", "Commission %", "Target Profit %", "GST %", "Dine-in", "Takeaway", "Delivery"];
const n2 = (v: number) => (Math.round(v * 100) / 100).toString();

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function MenuIO({ items }: { items: MenuItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const exportCsv = () => {
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const lines = [HEADERS.join(",")];
    for (const i of items) {
      const p = i.pricing;
      if (p) {
        const r = computePricing({
          recipeCost: i.recipeCost, packaging: p.packaging_cost, wastage: p.wastage_pct, labor: p.labor_cost,
          utility: p.utility_cost, overhead: p.overhead_cost, marketing: p.marketing_cost,
          commission: p.commission_pct, targetProfit: p.target_profit_pct, gst: p.gst_pct,
        });
        lines.push([i.name, n2(i.recipeCost), n2(p.packaging_cost), n2(p.wastage_pct), n2(p.labor_cost), n2(p.utility_cost),
          n2(p.overhead_cost), n2(p.marketing_cost), n2(p.commission_pct), n2(p.target_profit_pct), n2(p.gst_pct),
          n2(r.dinePrice), n2(r.takeawayPrice), n2(r.deliveryPrice)].map((v) => esc(String(v))).join(","));
      } else {
        lines.push([i.name, n2(i.recipeCost), "0", "0", "0", "0", "0", "0", "0", "0", "0", "", "", ""].map((v) => esc(String(v))).join(","));
      }
    }
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "menu-pricing.csv"; a.click();
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
      const iName = idx("sales item", "item", "product");
      if (iName < 0) { toast("CSV needs a 'Sales Item' column. Tip: export first for the right format.", "error"); if (fileRef.current) fileRef.current.value = ""; return; }
      const cols = {
        packaging: idx("packaging", "packaging cost"), wastage: idx("wastage %", "wastage"), labor: idx("labor", "labour", "labor cost"),
        utility: idx("utility", "utility cost"), overhead: idx("overhead", "overhead cost"), marketing: idx("marketing", "marketing cost"),
        commission: idx("commission %", "commission"), targetProfit: idx("target profit %", "target profit", "profit %"), gst: idx("gst %", "gst"),
      };
      const at = (r: string[], i: number) => (i >= 0 ? (r[i] || "").trim() : "");
      const rows: RawMenuRow[] = grid.slice(1).map((r) => ({
        salesItem: at(r, iName), packaging: at(r, cols.packaging), wastage: at(r, cols.wastage), labor: at(r, cols.labor),
        utility: at(r, cols.utility), overhead: at(r, cols.overhead), marketing: at(r, cols.marketing),
        commission: at(r, cols.commission), targetProfit: at(r, cols.targetProfit), gst: at(r, cols.gst),
      })).filter((r) => r.salesItem);

      if (rows.length === 0) { toast("No rows found in the file", "error"); if (fileRef.current) fileRef.current.value = ""; return; }

      start(async () => {
        const res = await importMenuPricing(rows);
        if (res.error) toast(res.error, "error");
        else {
          const up = res.updated ?? 0, sk = res.skipped ?? 0;
          toast(`Priced ${up} item${up === 1 ? "" : "s"}${sk ? `, skipped ${sk} unknown` : ""}`);
          router.refresh();
        }
        if (fileRef.current) fileRef.current.value = "";
      });
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={exportCsv} disabled={items.length === 0}>
        <Download className="h-4 w-4" /> Export CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={pending}>
        <Upload className="h-4 w-4" /> Import CSV
      </Button>
      <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={onImport} aria-hidden />
      <span className="text-xs text-muted-foreground">Bulk price: fill the cost columns and import — dine-in/takeaway/delivery prices are recalculated from each item&apos;s recipe.</span>
    </div>
  );
}
