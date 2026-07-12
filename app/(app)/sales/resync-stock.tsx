"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resyncSalesConsumption } from "@/server/actions/sales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";

export function ResyncStock() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [result, setResult] = useState<{ matched: number; unmatched: string[] } | null>(null);

  function run() {
    setResult(null);
    start(async () => {
      const res = await resyncSalesConsumption(from, to);
      if (res?.error) { toast(res.error, "error"); return; }
      setResult({ matched: res.matched ?? 0, unmatched: res.unmatched ?? [] });
      toast(`Stock re-synced — ${res.matched ?? 0} item(s) matched`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Recalculate raw-material and finished-goods deductions from sales in a date range. This runs automatically on every import — use it to re-sync after fixing recipes or item names. Safe to run repeatedly (it never double-counts).
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="rs-from">From</Label>
          <Input id="rs-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rs-to">To</Label>
          <Input id="rs-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <Button onClick={run} disabled={pending}>{pending ? "Re-syncing…" : "Re-sync stock from sales"}</Button>
      </div>
      {result && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p><b>{result.matched}</b> sold item{result.matched === 1 ? "" : "s"} matched to a recipe and deducted from stock.</p>
          {result.unmatched.length > 0 && (
            <div className="mt-2">
              <p className="text-amber-600">{result.unmatched.length} item name{result.unmatched.length === 1 ? "" : "s"} had no matching Sales ingredient (no stock deducted):</p>
              <p className="mt-1 text-muted-foreground">{result.unmatched.join(", ")}</p>
              <p className="mt-1 text-xs text-muted-foreground">Fix by naming the Sales ingredient exactly like the POS item, then re-sync.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
