"use client";
import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { Download, Upload } from "lucide-react";
import { importInventoryCounts, type RawInventoryRow } from "@/server/actions/inventory";

type Row = { name: string; category: string; uom: string; qty: number; value: number; reorder: number; status: string };

const HEADERS = ["Ingredient", "Category", "UOM", "In Hand", "Stock Value", "Reorder", "Status"];
const n = (v: number) => (Math.round(v * 10000) / 10000).toString();

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

export function InventoryIO({ rows: data }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const exportCsv = () => {
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const lines = [HEADERS.join(",")];
    for (const r of data) {
      lines.push([r.name, r.category, r.uom, n(r.qty), n(r.value), n(r.reorder), r.status]
        .map((v) => esc(String(v ?? ""))).join(","));
    }
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "inventory.csv"; a.click();
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
      const iName = idx("ingredient", "item", "name");
      const iQty = idx("in hand", "in-hand", "on hand", "qty", "quantity", "stock");
      if (iName < 0 || iQty < 0) {
        toast("CSV needs Ingredient and In Hand columns. Tip: export first for the right format.", "error");
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      const at = (r: string[], i: number) => (i >= 0 ? (r[i] || "").trim() : "");
      const rows: RawInventoryRow[] = grid.slice(1)
        .map((r) => ({ name: at(r, iName), target: at(r, iQty) }))
        .filter((r) => r.name);

      if (rows.length === 0) { toast("No items found in the file", "error"); if (fileRef.current) fileRef.current.value = ""; return; }

      start(async () => {
        const res = await importInventoryCounts(rows);
        if (res.error) toast(res.error, "error");
        else {
          const up = res.updated ?? 0, un = res.unchanged ?? 0, sk = res.skipped ?? 0;
          toast(`Stock updated for ${up} item${up === 1 ? "" : "s"}${un ? `, ${un} unchanged` : ""}${sk ? `, skipped ${sk} unknown/blank` : ""}`);
          router.refresh();
        }
        if (fileRef.current) fileRef.current.value = "";
      });
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={exportCsv} disabled={data.length === 0}>
        <Download className="h-4 w-4" /> Export CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={pending}>
        <Upload className="h-4 w-4" /> Import stock-take
      </Button>
      <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={onImport} aria-hidden />
      <span className="text-xs text-muted-foreground">
        Stock-take for this branch: edit the &quot;In Hand&quot; column and import — each item is adjusted to the counted quantity.
      </span>
    </div>
  );
}
