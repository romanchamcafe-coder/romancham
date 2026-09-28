"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { FormIngredient, FormUnit } from "@/server/queries/purchases";
import { importPurchases, type ImportBill, type PurchaseLine } from "@/server/actions/purchases";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { inr } from "@/lib/utils";
import { Download, Upload, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";

type Vendor = { id: string; name: string };
type Branch = { id: string; name: string };

const HEADERS = ["Bill Date", "Vendor", "Invoice No", "Payment (Credit / Petty Cash)", "Product", "Category",
  "Packaging", "Pack Size", "Pack Unit", "Purchase Qty", "Unit Price (per pack)", "GST %"];

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const UNIT_ALIAS: Record<string, string[]> = {
  g: ["g", "gm", "gms", "gram", "grams", "grm"], kg: ["kg", "kgs", "kilo", "kilogram", "kilograms"],
  ml: ["ml", "mls", "millilitre", "milliliter"], l: ["l", "lt", "ltr", "ltrs", "lts", "litre", "liter", "litres", "liters"],
  pcs: ["pcs", "pc", "piece", "pieces", "nos", "no", "qty", "unit", "units"], dz: ["dz", "dozen"],
};

function pad(n: number) { return String(n).padStart(2, "0"); }
function toIsoDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === "number" && v > 20000 && v < 80000) { // Excel serial date
    const d = new Date(Math.round((v - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/); // Indian style dd-mm-yyyy
  if (m) { const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; if (+m[2] <= 12) return `${y}-${pad(+m[2])}-${pad(+m[1])}`; }
  m = s.match(/^(\d{1,2})[- ]([A-Za-z]{3,})[- ,]*(\d{2,4})$/); // 24-Sep-2026
  if (m) {
    const mon = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[2].slice(0, 3).toLowerCase());
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    if (mon >= 0) return `${y}-${pad(mon + 1)}-${pad(+m[1])}`;
  }
  return null;
}
const toNum = (v: unknown) => {
  if (v == null || v === "") return NaN;
  const n = Number(String(v).replace(/[₹,\s%]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

// Minimal RFC-4180 CSV parser (quotes, embedded commas/newlines).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) { if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += ch; }
    else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
// ExcelJS cell value -> plain value (handles formulas, rich text, hyperlinks).
function cellVal(v: any): unknown {
  if (v == null) return "";
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return cellVal(v.result);
    if ("richText" in v) return (v.richText as { text: string }[]).map((t) => t.text).join("");
    if ("text" in v) return v.text;
    return "";
  }
  return v;
}
async function download(buf: ArrayBuffer, name: string) {
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type ParsedRow = {
  row: number; date: string | null; vendor: string; vendorId: string; invoice: string; mode: "credit" | "petty_cash";
  product: string; ing: FormIngredient | null; line: PurchaseLine | null; value: number; errors: string[];
};

export function PurchaseImport({ vendors, ingredients, units, branches, defaultBranchId }: {
  vendors: Vendor[]; ingredients: FormIngredient[]; units: FormUnit[]; branches: Branch[]; defaultBranchId: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [branchId, setBranchId] = useState(defaultBranchId || branches[0]?.id || "");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<{ created: number; skipped: { key: string; reason: string }[]; failed: { key: string; error: string }[] } | null>(null);

  const vendorBy = useMemo(() => new Map(vendors.map((v) => [norm(v.name), v])), [vendors]);
  const ingBy = useMemo(() => new Map(ingredients.map((i) => [norm(i.name), i])), [ingredients]);
  const unitBy = useMemo(() => {
    const m = new Map<string, FormUnit>();
    for (const u of units) { m.set(norm(u.abbr), u); m.set(norm(u.name), u); }
    for (const [canon, aliases] of Object.entries(UNIT_ALIAS)) {
      const u = units.find((x) => aliases.includes(norm(x.abbr)) || norm(x.abbr) === canon);
      if (u) for (const a of aliases) if (!m.has(a)) m.set(a, u);
    }
    return m;
  }, [units]);

  async function loadExcel() { return (await import("exceljs")).default; }

  async function downloadTemplate() {
    const ExcelJS = await loadExcel();
    const wb = new ExcelJS.Workbook();
    const today = new Date();
    const d = `${pad(today.getDate())}-${pad(today.getMonth() + 1)}-${today.getFullYear()}`;
    const v1 = vendors[0]?.name ?? "Your Vendor";
    const p1 = ingredients[0], p2 = ingredients[1] ?? ingredients[0];
    const sheet = (name: string, rows: unknown[][], widths: number[]) => {
      const ws = wb.addWorksheet(name);
      ws.addRows(rows);
      widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: "frozen", ySplit: 1 }];
      return ws;
    };
    const main = sheet("Purchases", [HEADERS,
      [d, v1, "INV-101", "Credit", p1?.name ?? "Product name", p1?.category_name ?? "", "Packet", 1, p1?.base_uom || "kg", 2, 120, p1?.default_gst_rate ?? 5],
      [d, v1, "INV-101", "Credit", p2?.name ?? "Product name", p2?.category_name ?? "", "Bottle", 500, "ml", 6, 45, p2?.default_gst_rate ?? 5],
    ], [12, 26, 12, 16, 30, 18, 12, 10, 10, 12, 18, 8]);
    main.getColumn(1).numFmt = "@"; // keep dd-mm-yyyy as typed
    main.getColumn(3).numFmt = "@";
    main.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF97316" } };
    main.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    // Dropdowns on the Purchases sheet (rows 2-500).
    const vCount = Math.max(vendors.length, 1), pCount = Math.max(ingredients.length, 1), uCount = Math.max(units.length, 1);
    for (let r = 2; r <= 500; r++) {
      main.getCell(`B${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [`Vendors!$A$2:$A$${vCount + 1}`] };
      main.getCell(`D${r}`).dataValidation = { type: "list", allowBlank: true, formulae: ['"Credit,Petty Cash"'] };
      main.getCell(`E${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [`Products!$A$2:$A$${pCount + 1}`] };
      main.getCell(`I${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [`Units!$A$2:$A$${uCount + 1}`] };
    }
    sheet("How to fill", [
      ["How to fill the Purchases sheet"],
      ["One row = one product line. Rows with the same Bill Date + Vendor + Invoice No + Payment become ONE bill."],
      ["Bill Date: dd-mm-yyyy (e.g. 24-09-2026) or a normal Excel date."],
      ["Vendor and Product: pick from the dropdown (or type the exact name from the Vendors / Products sheets). Case doesn't matter."],
      ["Payment: Credit or Petty Cash (blank = Credit)."],
      ["Pack Size + Pack Unit = what is inside ONE package, e.g. 500 + g, 1 + kg, 1 + L. Blank = 1 of the product's own unit."],
      ["Purchase Qty = number of packages. Unit Price = price of ONE package, WITHOUT GST."],
      ["Category and GST % can be left blank - they are taken from the product master."],
      ["Delete the two example rows before uploading. Uploading the same Vendor + Invoice No + Date again is skipped automatically."],
      ["New vendor or product? Add it in Romancham first (Vendors / Ingredients), then download a fresh template."],
    ], [120]);
    sheet("Vendors", [["Vendor"], ...[...vendors].sort((a, b) => a.name.localeCompare(b.name)).map((v) => [v.name])], [34]);
    sheet("Products", [["Product", "Base Unit", "Category", "Default GST %"],
      ...[...ingredients].sort((a, b) => a.name.localeCompare(b.name)).map((i) => [i.name, i.base_uom, i.category_name, i.default_gst_rate])], [34, 10, 22, 14]);
    sheet("Units", [["Unit", "Name"], ...units.map((u) => [u.abbr, u.name])], [10, 20]);
    const buf = await wb.xlsx.writeBuffer();
    await download(buf as ArrayBuffer, "romancham-purchase-upload-template.xlsx");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null); setFileName(file.name);
    try {
      let grid: unknown[][] = [];
      if (/\.csv$/i.test(file.name)) {
        grid = parseCsv(await file.text());
      } else {
        const ExcelJS = await loadExcel();
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(await file.arrayBuffer());
        const ws = wb.worksheets.find((w) => norm(w.name) === "purchases") ?? wb.worksheets[0];
        if (!ws) throw new Error("the file has no sheets");
        for (let r = 1; r <= ws.rowCount; r++) {
          const row = ws.getRow(r);
          const vals: unknown[] = [];
          for (let c = 1; c <= Math.max(row.cellCount, HEADERS.length); c++) vals.push(cellVal(row.getCell(c).value));
          grid.push(vals);
        }
      }
      const hIdx = grid.findIndex((r) => r.some((c) => norm(c) === "product"));
      if (hIdx < 0) { toast("Couldn't find the header row (needs a 'Product' column). Download the template to see the format.", "error"); setRows([]); return; }
      const header = grid[hIdx].map((h) => norm(h));
      const col = (...names: string[]) => header.findIndex((h) => names.some((n) => h === n || h.startsWith(n)));
      const c = {
        date: col("bill date", "date"), vendor: col("vendor", "supplier"), inv: col("invoice", "bill no", "invoice no"),
        pay: col("payment", "petty cash/credit", "mode"), product: col("product", "item", "ingredient"), cat: col("category"),
        pack: col("packaging", "package"), size: col("pack size", "size"), unit: col("pack unit", "unit", "uom"),
        qty: col("purchase qty", "qty", "quantity"), price: col("unit price", "price", "rate"), gst: col("gst"),
      };
      const at = (r: unknown[], i: number) => (i >= 0 ? r[i] : "");
      const out: ParsedRow[] = [];
      grid.slice(hIdx + 1).forEach((r, k) => {
        if (!r.some((x) => String(x ?? "").trim() !== "")) return;
        const errors: string[] = [];
        const date = toIsoDate(at(r, c.date));
        if (!date) errors.push("Bill date missing/invalid");
        const vendorName = String(at(r, c.vendor) ?? "").trim();
        const vendor = vendorBy.get(norm(vendorName));
        if (!vendorName) errors.push("Vendor missing"); else if (!vendor) errors.push(`Vendor "${vendorName}" not found`);
        const productName = String(at(r, c.product) ?? "").trim();
        const ing = ingBy.get(norm(productName)) ?? null;
        if (!productName) errors.push("Product missing"); else if (!ing) errors.push(`Product "${productName}" not found`);
        const qty = toNum(at(r, c.qty));
        if (!(qty > 0)) errors.push("Purchase Qty must be > 0");
        const price = toNum(at(r, c.price));
        if (!(price >= 0)) errors.push("Unit Price missing");
        const sizeRaw = toNum(at(r, c.size));
        const size = Number.isNaN(sizeRaw) ? 1 : sizeRaw;
        if (!(size > 0)) errors.push("Pack Size must be > 0");
        const unitTxt = String(at(r, c.unit) ?? "").trim();
        let unitId = ing?.base_unit_id ?? "";
        if (unitTxt) { const u = unitBy.get(norm(unitTxt)); if (u) unitId = u.id; else errors.push(`Unit "${unitTxt}" not found`); }
        const gstRaw = toNum(at(r, c.gst));
        const gst = Number.isNaN(gstRaw) ? (ing?.default_gst_rate ?? 0) : gstRaw;
        const payTxt = norm(at(r, c.pay));
        const mode: "credit" | "petty_cash" = /petty|cash/.test(payTxt) ? "petty_cash" : "credit";
        const category = String(at(r, c.cat) ?? "").trim() || ing?.category_name || "";
        const line: PurchaseLine | null = ing ? {
          ingredient_id: ing.id, category, purchase_uom: String(at(r, c.pack) ?? "").trim(),
          pack_qty: qty, pack_size: size, pack_size_unit_id: unitId, unit_price: price, gst_rate: gst, uom: ing.base_uom,
        } : null;
        out.push({
          row: hIdx + k + 2, date, vendor: vendor?.name ?? vendorName, vendorId: vendor?.id ?? "",
          invoice: String(at(r, c.inv) ?? "").trim(), mode, product: ing?.name ?? productName, ing, line,
          value: (qty > 0 && price >= 0) ? qty * price * (1 + gst / 100) : 0, errors,
        });
      });
      setRows(out);
      if (out.length === 0) toast("No data rows found in the file", "error");
    } catch (err: any) {
      toast(`Couldn't read the file: ${err?.message ?? "unknown error"}`, "error");
      setRows([]);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const bills = useMemo(() => {
    const m = new Map<string, { key: string; date: string; vendor: string; vendorId: string; invoice: string; mode: "credit" | "petty_cash"; rows: ParsedRow[] }>();
    for (const r of rows) {
      const key = `${r.date ?? "?"}|${r.vendorId || r.vendor}|${r.invoice}|${r.mode}`;
      const b = m.get(key) ?? { key, date: r.date ?? "", vendor: r.vendor, vendorId: r.vendorId, invoice: r.invoice, mode: r.mode, rows: [] };
      b.rows.push(r); m.set(key, b);
    }
    return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [rows]);
  const good = bills.filter((b) => b.rows.every((r) => r.errors.length === 0));
  const badRows = rows.filter((r) => r.errors.length > 0);
  const goodValue = good.reduce((s, b) => s + b.rows.reduce((t, r) => t + r.value, 0), 0);

  function runImport() {
    const payload: ImportBill[] = good.map((b) => ({
      key: `${b.date} · ${b.vendor}${b.invoice ? ` · ${b.invoice}` : ""}`,
      vendor_id: b.vendorId, branch_id: branchId, payment_mode: b.mode, bill_no: b.invoice, bill_date: b.date,
      items: b.rows.map((r) => r.line!).filter(Boolean),
    }));
    start(async () => {
      const res = await importPurchases(payload);
      if (res.error) { toast(res.error, "error"); return; }
      setResult({ created: res.created ?? 0, skipped: res.skipped ?? [], failed: res.failed ?? [] });
      toast(`Imported ${res.created ?? 0} bill${res.created === 1 ? "" : "s"}`);
      setRows([]);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card><CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-end gap-3">
          <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4" /> Download Excel template</Button>
          <div className="space-y-1">
            <Label className="text-xs">Location</Label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} aria-label="Location"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <Button onClick={() => fileRef.current?.click()} disabled={pending}><Upload className="h-4 w-4" /> Upload Excel / CSV</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={onFile} aria-hidden />
          {fileName && <span className="flex items-center gap-1 text-sm text-muted-foreground"><FileSpreadsheet className="h-4 w-4" /> {fileName}</span>}
        </div>
        <p className="text-xs text-muted-foreground">
          One row per product. Rows with the same <b>Bill Date + Vendor + Invoice No + Payment</b> are saved as one bill.
          Vendor and product names must already exist (the template lists them). Nothing is saved until you click <b>Import</b>.
        </p>
      </CardContent></Card>

      {result && (
        <Card><CardContent className="space-y-2 pt-6 text-sm">
          <p className="flex items-center gap-2 font-medium text-green-600"><CheckCircle2 className="h-4 w-4" /> {result.created} bill{result.created === 1 ? "" : "s"} imported.</p>
          {result.skipped.length > 0 && <div><p className="font-medium">Skipped ({result.skipped.length}):</p><ul className="list-disc pl-5 text-muted-foreground">{result.skipped.map((s) => <li key={s.key}>{s.key} — {s.reason}</li>)}</ul></div>}
          {result.failed.length > 0 && <div><p className="font-medium text-destructive">Failed ({result.failed.length}):</p><ul className="list-disc pl-5 text-destructive">{result.failed.map((s) => <li key={s.key}>{s.key} — {s.error}</li>)}</ul></div>}
          <Link href="/purchases" className="text-primary underline">View purchases →</Link>
        </CardContent></Card>
      )}

      {rows.length > 0 && (
        <>
          <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <div className="text-sm">
              <b>{rows.length}</b> rows → <b>{bills.length}</b> bills ·{" "}
              <span className="text-green-600"><b>{good.length}</b> ready ({inr(goodValue)} incl. GST)</span>
              {badRows.length > 0 && <> · <span className="text-destructive"><b>{badRows.length}</b> row{badRows.length === 1 ? "" : "s"} with errors (their bills are skipped)</span></>}
            </div>
            <Button onClick={runImport} disabled={pending || good.length === 0}>
              {pending ? "Importing…" : `Import ${good.length} bill${good.length === 1 ? "" : "s"}`}
            </Button>
          </CardContent></Card>

          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr><th className="p-2">Row</th><th className="p-2">Date</th><th className="p-2">Vendor</th><th className="p-2">Invoice</th><th className="p-2">Payment</th><th className="p-2">Product</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Price</th><th className="p-2 text-right">With GST</th><th className="p-2">Status</th></tr>
              </thead>
              <tbody>
                {rows.slice(0, 500).map((r) => (
                  <tr key={r.row} className={`border-b ${r.errors.length ? "bg-destructive/10" : ""}`}>
                    <td className="p-2 text-muted-foreground">{r.row}</td>
                    <td className="p-2">{r.date ?? "—"}</td>
                    <td className="p-2">{r.vendor || "—"}</td>
                    <td className="p-2">{r.invoice || "—"}</td>
                    <td className="p-2">{r.mode === "petty_cash" ? "Petty Cash" : "Credit"}</td>
                    <td className="p-2">{r.product || "—"}</td>
                    <td className="p-2 text-right">{r.line?.pack_qty ?? "—"}</td>
                    <td className="p-2 text-right">{r.line ? inr(r.line.unit_price) : "—"}</td>
                    <td className="p-2 text-right">{r.value ? inr(r.value) : "—"}</td>
                    <td className="p-2">{r.errors.length
                      ? <span className="flex items-start gap-1 text-destructive"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{r.errors.join("; ")}</span>
                      : <span className="text-green-600">OK</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 500 && <p className="p-2 text-xs text-muted-foreground">Showing first 500 rows.</p>}
          </Card>
        </>
      )}
    </div>
  );
}
