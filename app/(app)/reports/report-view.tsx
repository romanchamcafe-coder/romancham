"use client";
import type { Report } from "@/lib/report-defs";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { inr } from "@/lib/utils";
import { Download, Printer } from "lucide-react";

const fmt = (v: string | number, isCurrency: boolean) =>
  isCurrency && typeof v === "number" ? inr(v) : String(v);

export function ReportView({
  title, branch, from, to, data,
}: {
  title: string; branch: string; from: string; to: string; data: Report;
}) {
  const cur = new Set(data.currencyCols ?? []);

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      data.headers.map(esc).join(","),
      ...data.rows.map((r) => r.map(esc).join(",")),
    ];
    if (data.totals) lines.push(data.totals.map(esc).join(","));
    const csv = lines.join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4 print:border-0 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{branch} · {from} → {to}</p>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data.rows.length}>
            <Download className="h-4 w-4" /> CSV / Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print / PDF
          </Button>
        </div>
      </div>

      {data.note && <p className="text-xs text-muted-foreground">{data.note}</p>}

      {data.rows.length === 0 ? (
        <p className="rounded-md bg-muted/40 p-4 text-center text-sm text-muted-foreground">No data for this range.</p>
      ) : (
        <Table>
          <THead>
            <TR>{data.headers.map((h, i) => (
              <TH key={i} className={cur.has(i) || (i > 0 && typeof data.rows[0][i] === "number") ? "text-right" : ""}>{h}</TH>
            ))}</TR>
          </THead>
          <TBody>
            {data.rows.map((row, ri) => (
              <TR key={ri}>
                {row.map((cell, ci) => (
                  <TD key={ci} className={`${cur.has(ci) || typeof cell === "number" ? "text-right tabular-nums" : ""} ${ci === 0 ? "font-medium" : ""}`}>
                    {fmt(cell, cur.has(ci))}
                  </TD>
                ))}
              </TR>
            ))}
            {data.totals && (
              <TR className="border-t-2 font-semibold">
                {data.totals.map((cell, ci) => (
                  <TD key={ci} className={`${cur.has(ci) || typeof cell === "number" ? "text-right tabular-nums" : ""}`}>
                    {fmt(cell, cur.has(ci))}
                  </TD>
                ))}
              </TR>
            )}
          </TBody>
        </Table>
      )}
    </div>
  );
}
