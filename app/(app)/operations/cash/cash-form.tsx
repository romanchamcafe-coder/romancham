"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCashRecon } from "@/server/actions/finance";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inr } from "@/lib/utils";

type Existing = { opening_float: number; cash_out: number; counted: number; note: string | null; variance: number } | null;

export function CashForm({ cashSalesToday, existing }: { cashSalesToday: number; existing: Existing }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openingFloat, setOpeningFloat] = useState(existing ? String(existing.opening_float) : "");
  const [cashOut, setCashOut] = useState(existing ? String(existing.cash_out) : "");
  const [counted, setCounted] = useState(existing ? String(existing.counted) : "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [err, setErr] = useState<string | null>(null);

  const n = (v: string) => Number(v || 0) || 0;
  const expected = Math.round((n(openingFloat) + cashSalesToday - n(cashOut)) * 100) / 100;
  const variance = counted === "" ? null : Math.round((n(counted) - expected) * 100) / 100;

  const submit = () => {
    setErr(null);
    if (counted === "") { setErr("Enter the counted cash"); return; }
    start(async () => {
      const res = await saveCashRecon({ opening_float: openingFloat, cash_out: cashOut, counted, note });
      if (res?.error) { setErr(res.error); return; }
      toast(`Saved · variance ${res.variance! > 0 ? "+" : ""}${inr(res.variance ?? 0)}`);
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Opening float (₹)</Label>
          <Input type="number" inputMode="decimal" step="0.01" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} placeholder="0" className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label>Cash paid out (₹)</Label>
          <Input type="number" inputMode="decimal" step="0.01" value={cashOut} onChange={(e) => setCashOut(e.target.value)} placeholder="0" className="h-11" />
        </div>
      </div>

      <div className="rounded-lg bg-muted/40 p-3 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Cash sales today (from POS)</span><span className="tabular-nums">{inr(cashSalesToday)}</span></div>
        <div className="mt-1 flex justify-between font-medium"><span>Expected in drawer</span><span className="tabular-nums">{inr(expected)}</span></div>
      </div>

      <div className="space-y-1.5">
        <Label>Counted cash (₹)</Label>
        <Input type="number" inputMode="decimal" step="0.01" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="Count the drawer" className="h-12 text-lg" />
      </div>

      {variance !== null && (
        <div className={`rounded-lg p-3 text-center text-sm font-semibold ${variance === 0 ? "bg-green-50 text-green-700" : Math.abs(variance) < 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
          {variance === 0 ? "Balanced ✓" : `${variance > 0 ? "Over" : "Short"} by ${inr(Math.abs(variance))}`}
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Note <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. ₹20 tip float" className="h-11" />
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button className="h-12 w-full text-base" onClick={submit} disabled={pending}>{pending ? "Saving…" : existing ? "Update reconciliation" : "Save reconciliation"}</Button>
    </div>
  );
}
