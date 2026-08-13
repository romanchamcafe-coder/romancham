"use client";
import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toast";
import { setPurchasePayment } from "@/server/actions/purchases";
import { inr } from "@/lib/utils";
import { ChevronUp, ChevronDown, MoveHorizontal, Check, Undo2 } from "lucide-react";
import type { PurchaseBillRow } from "@/server/queries/purchases";

const modeLabel = (m: string | null) => (m === "petty_cash" ? "Petty Cash" : m === "credit" ? "Credit" : "—");

const COLS: { key: string; label: string; numeric?: boolean }[] = [
  { key: "payment_mode", label: "Petty cash/Credit" },
  { key: "vendor", label: "Vendor" },
  { key: "location", label: "Location" },
  { key: "bill_no", label: "Invoice No" },
  { key: "bill_date", label: "Bill Date" },
  { key: "without_gst", label: "Without GST", numeric: true },
  { key: "with_gst", label: "With GST", numeric: true },
  { key: "payment_status", label: "Paid / Unpaid" },
];

export function PurchaseBillsTable({ rows, sort, dir }: { rows: PurchaseBillRow[]; sort?: string; dir?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const sortBy = (key: string) => {
    const params = new URLSearchParams(sp.toString());
    const nextDir = sort === key && dir === "asc" ? "desc" : "asc";
    params.set("sort", key); params.set("dir", nextDir); params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  const setPaid = (purchaseId: string, status: "paid" | "unpaid") => {
    start(async () => {
      const res = await setPurchasePayment(purchaseId, status);
      if (res?.error) toast(res.error, "error");
      else { toast(status === "paid" ? "Bill marked paid" : "Bill marked unpaid"); router.refresh(); }
    });
  };

  const cell = (key: string, r: PurchaseBillRow) => {
    switch (key) {
      case "payment_mode": return <Badge tone={r.payment_mode === "petty_cash" ? "green" : "amber"}>{modeLabel(r.payment_mode)}</Badge>;
      case "without_gst": return inr(r.without_gst);
      case "with_gst": return inr(r.with_gst);
      case "payment_status": return r.payment_status === "paid"
        ? <Badge tone="green">Paid{r.paid_on ? ` · ${r.paid_on}` : ""}</Badge>
        : <Badge tone="red">Unpaid</Badge>;
      default: return ((r as any)[key] as string) ?? "—";
    }
  };

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <MoveHorizontal className="h-3.5 w-3.5" aria-hidden /> One row per bill · click a header to sort
      </p>
      <Card className="max-h-[70vh] overflow-auto">
        <table className="w-full whitespace-nowrap text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-left shadow-sm">
            <tr>
              {COLS.map((c) => (
                <th key={c.key} onClick={() => sortBy(c.key)}
                  aria-sort={sort === c.key ? (dir === "asc" ? "ascending" : "descending") : "none"}
                  className={"cursor-pointer select-none px-3 py-2 font-medium hover:bg-muted/70 " + (c.numeric ? "text-right" : "")}>
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {sort === c.key && (dir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.purchase_id} className="border-b last:border-0 hover:bg-muted/40">
                {COLS.map((c) => (
                  <td key={c.key} className={"px-3 py-2 " + (c.numeric ? "text-right tabular-nums" : "") + (c.key === "vendor" ? " font-medium" : "")}>
                    {cell(c.key, r)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  {r.payment_status === "paid" ? (
                    <button onClick={() => setPaid(r.purchase_id, "unpaid")} disabled={pending}
                      aria-label={`Mark bill ${r.bill_no} unpaid`} title="Mark unpaid"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">
                      <Undo2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <button onClick={() => setPaid(r.purchase_id, "paid")} disabled={pending}
                      aria-label={`Mark bill ${r.bill_no} paid`} title="Mark as paid"
                      className="inline-flex h-8 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10">
                      <Check className="h-4 w-4" /> Paid
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={COLS.length + 1} className="px-3 py-8 text-center text-muted-foreground">No bills match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
