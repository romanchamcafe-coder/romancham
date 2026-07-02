"use client";
import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importPosSales } from "@/server/actions/sales";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const MAP: Record<string, string> = {
  "date": "date_raw", "location": "location", "invoice no": "invoice_no", "payment type": "payment_type",
  "order type": "order_type", "area": "area", "item name": "item_name", "price": "price", "qty": "qty",
  "without gst": "without_gst", "discount": "discount", "tax": "tax", "final total": "final_total",
  "status": "status", "table no": "table_no", "server name": "server_name", "covers": "covers",
  "variation": "variation", "category": "category", "group name": "group_name", "hsn": "hsn",
  "phone": "phone", "name": "customer_name", "address": "address", "gst": "gst", "assign to": "assign_to",
  "non taxable": "non_taxable", "c gst rate": "cgst_rate", "c gst amount": "cgst_amount",
  "s gst rate": "sgst_rate", "s gst amount": "sgst_amount",
};
const NUM = new Set(["price","qty","without_gst","discount","tax","final_total","cgst_rate","cgst_amount","sgst_rate","sgst_amount"]);

function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let f = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else { if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
      else if (c === "\r") { /* skip */ } else f += c; }
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const norm = (h: string) => h.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
function toNum(s: string) { if (s == null) return null; const v = String(s).replace(/[^0-9.\-]/g, ""); return v === "" || isNaN(Number(v)) ? null : Number(v); }
function toDate(s: string) {
  if (!s) return null;
  const d = String(s).trim().split(/[ T]/)[0];
  let m = d.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = d.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) { let [, dd, mm, yy] = m; if (yy.length === 2) yy = "20" + yy; return `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`; }
  const t = Date.parse(s);
  return isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

export function SalesUpload({ branchId }: { branchId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [unmapped, setUnmapped] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null); setMsg(null); setRows(null); setUnmapped([]);
    const file = e.target.files?.[0]; if (!file) return; setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const grid = parseCSV(String(reader.result || "")).filter((r) => r.some((c) => c.trim() !== ""));
        if (grid.length < 2) { setErr("This file has no data rows."); return; }
        const headers = grid[0].map(norm);
        setUnmapped(grid[0].filter((_, i) => !MAP[headers[i]]));
        const out = grid.slice(1).map((cells) => {
          const o: any = {};
          headers.forEach((h, i) => {
            const field = MAP[h]; if (!field) return;
            let val: any = (cells[i] ?? "").trim();
            o[field] = NUM.has(field) ? toNum(val) : (val === "" ? null : val);
          });
          o.sale_date = toDate(o.date_raw || "");
          return o;
        }).filter((o) => o.item_name || o.invoice_no);
        setRows(out);
        setMsg(`${out.length} rows ready to import.`);
      } catch { setErr("Could not read this file — please upload a CSV export."); }
    };
    reader.readAsText(file);
  }

  function doImport() {
    if (!rows?.length) return;
    setErr(null);
    start(async () => {
      const res = await importPosSales(rows, branchId, fileName);
      if (res?.error) setErr(res.error);
      else { setMsg(`Imported ${res.imported} rows. Same-day data was replaced.`); setRows(null); setFileName(""); if (inputRef.current) inputRef.current.value = ""; router.refresh(); }
    });
  }

  return (
    <Card><CardContent className="space-y-3 pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={onFile}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:opacity-90" />
        <Button onClick={doImport} disabled={!rows?.length || pending}>{pending ? "Importing…" : "Import"}</Button>
      </div>
      <p className="text-xs text-muted-foreground">Upload your Petpooja sales CSV. Re-uploading the same day&apos;s file replaces that day&apos;s rows (no duplicates).</p>
      {fileName && <p className="text-sm font-medium">{fileName}</p>}
      {msg && <p className="text-sm text-green-600">{msg}</p>}
      {err && <p className="text-sm text-destructive">{err}</p>}
      {unmapped.length > 0 && <p className="text-xs text-amber-600">Unmatched columns (ignored): {unmapped.join(", ")} — tell me and I&apos;ll map them.</p>}
    </CardContent></Card>
  );
}
