"use client";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Download, Search } from "lucide-react";

export type Col = { key: string; label: string; align?: "right"; bold?: boolean };
type Row = Record<string, string | number>;

// Read-only list with search, optional group filter, totals and CSV export.
export function OverviewTable({ title, rows, cols, groupKey, filename }: {
  title: string; rows: Row[]; cols: Col[]; groupKey?: string; filename: string;
}) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("all");
  const groups = useMemo(() => {
    if (!groupKey) return [];
    const m = new Map<string, number>();
    for (const r of rows) { const g = String(r[groupKey] ?? "—"); m.set(g, (m.get(g) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows, groupKey]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => (group === "all" || String(r[groupKey!] ?? "—") === group)
      && (!s || cols.some((c) => String(r[c.key] ?? "").toLowerCase().includes(s))));
  }, [rows, q, group, groupKey, cols]);

  function exportCsv() {
    const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [cols.map((c) => c.label), ...shown.map((r) => cols.map((c) => r[c.key]))];
    const blob = new Blob([lines.map((l) => l.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg border bg-primary/5 px-4 py-2">
          <p className="text-xs text-muted-foreground">Total {title}</p>
          <p className="text-2xl font-bold tabular-nums text-primary">{rows.length}</p>
        </div>
        {groups.map(([g, n]) => (
          <div key={g} className="rounded-lg border px-3 py-2">
            <p className="text-xs text-muted-foreground">{g}</p>
            <p className="text-lg font-semibold tabular-nums">{n}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${title.toLowerCase()}…`} className="h-9 pl-8" />
        </div>
        {groups.length > 1 && (
          <>
            <button type="button" onClick={() => setGroup("all")} className={cn("rounded-md px-3 py-1.5 text-sm", group === "all" ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted")}>All</button>
            {groups.map(([g]) => (
              <button key={g} type="button" onClick={() => setGroup(g)} className={cn("rounded-md px-3 py-1.5 text-sm", group === g ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted")}>{g}</button>
            ))}
          </>
        )}
        <span className="text-sm text-muted-foreground">Showing {shown.length} of {rows.length}</span>
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr><th className="p-2">#</th>{cols.map((c) => <th key={c.key} className={cn("p-2", c.align === "right" && "text-right")}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i} className="border-b">
                <td className="p-2 text-muted-foreground">{i + 1}</td>
                {cols.map((c) => <td key={c.key} className={cn("p-2", c.align === "right" && "text-right tabular-nums", c.bold && "font-medium")}>{r[c.key] === "" || r[c.key] == null ? "—" : r[c.key]}</td>)}
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={cols.length + 1} className="p-6 text-center text-muted-foreground">Nothing found.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
