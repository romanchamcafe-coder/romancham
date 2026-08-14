"use client";
import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { Download, Upload } from "lucide-react";
import { importIngredients, type RawIngredientRow } from "@/server/actions/ingredients";

type Item = {
  name: string; material_type?: string;
  category_name?: string; uom?: string; vendor_name?: string;
  default_gst_rate?: number; reorder_level?: number; hsn_code?: string | null;
};

const HEADERS = ["Name", "Type", "Category", "Unit", "GST %", "Reorder Level", "HSN", "Default Vendor"];
const dash = (s?: string) => (!s || s === "—" ? "" : s);

// Minimal RFC-4180 CSV parser (handles quotes, embedded commas and newlines).
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

export function IngredientsIO({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const exportCsv = () => {
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const lines = [HEADERS.join(",")];
    for (const i of items) {
      lines.push([
        i.name, dash(i.material_type), dash(i.category_name), dash(i.uom),
        String(i.default_gst_rate ?? 0), String(i.reorder_level ?? 0), dash(i.hsn_code ?? ""), dash(i.vendor_name),
      ].map((v) => esc(String(v ?? ""))).join(","));
    }
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ingredients.csv"; a.click();
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
      const iName = idx("name", "item", "ingredient");
      if (iName < 0) {
        toast("CSV needs a 'Name' column. Tip: export first to get the right format.", "error");
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      const iType = idx("type", "material type", "material_type");
      const iCat = idx("category");
      const iUnit = idx("unit", "uom", "unit (uom)", "base unit");
      const iGst = idx("gst %", "gst", "gst%", "gst_rate");
      const iReorder = idx("reorder level", "reorder", "reorder_level");
      const iHsn = idx("hsn", "hsn code", "hsn_code");
      const iVendor = idx("default vendor", "vendor");
      const at = (r: string[], i: number) => (i >= 0 ? (r[i] || "").trim() : "");

      const rows: RawIngredientRow[] = grid.slice(1).map((r) => ({
        name: at(r, iName), type: at(r, iType), category: at(r, iCat), unit: at(r, iUnit),
        gst: at(r, iGst), reorder: at(r, iReorder), hsn: at(r, iHsn), vendor: at(r, iVendor),
      })).filter((r) => r.name);

      if (rows.length === 0) { toast("No ingredient names found in the file", "error"); if (fileRef.current) fileRef.current.value = ""; return; }

      start(async () => {
        const res = await importIngredients(rows);
        if (res.error) toast(res.error, "error");
        else {
          const added = res.added ?? 0, skipped = res.skipped ?? 0;
          toast(`Imported ${added} ingredient${added === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} duplicate/blank` : ""}`);
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
      <span className="text-xs text-muted-foreground">
        Columns: Name, Type (purchase/sales/both), Category, Unit, GST %, Reorder Level, HSN, Default Vendor. Existing names are skipped.
      </span>
    </div>
  );
}
