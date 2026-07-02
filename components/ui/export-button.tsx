"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { Download } from "lucide-react";
import { exportSalesCsv, exportPurchasesCsv } from "@/server/actions/exports";

type Props = { kind: "sales" | "purchases"; filters: any; filename: string };

export function ExportButton({ kind, filters, filename }: Props) {
  const [pending, start] = useTransition();
  const run = () => start(async () => {
    const res = kind === "sales" ? await exportSalesCsv(filters) : await exportPurchasesCsv(filters);
    if (res.error) { toast(res.error, "error"); return; }
    if (!res.csv || res.csv.split("\r\n").length <= 1) { toast("Nothing to export", "error"); return; }
    const blob = new Blob(["﻿" + res.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
    toast("CSV downloaded");
  });
  return (
    <Button size="sm" variant="outline" onClick={run} disabled={pending} aria-label="Export current view to CSV">
      <Download className="mr-1 h-4 w-4" aria-hidden /> {pending ? "Exporting…" : "Export CSV"}
    </Button>
  );
}
