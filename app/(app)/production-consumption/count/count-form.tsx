"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toast";
import { inr } from "@/lib/utils";
import { submitPhysicalCount } from "@/server/actions/pnc";

const sel = "h-12 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
type Item = { id: string; name: string; uom: string };
type Result = { system_qty: number; counted_qty: number; variance_qty: number; variance_value: number };

export function CountForm({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [id, setId] = useState("");
  const [location, setLocation] = useState("display");
  const [counted, setCounted] = useState("");
  const [explanation, setExplanation] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const item = items.find((i) => i.id === id) || null;

  function submit() {
    setErr(null); setResult(null);
    if (!id) { setErr("Select a product"); return; }
    if (counted === "" || Number(counted) < 0) { setErr("Enter the counted quantity"); return; }
    start(async () => {
      const res = await submitPhysicalCount({ sales_item_id: id, counted_qty: counted, location, explanation });
      if (res?.error) setErr(res.error);
      else { setResult(res.result as unknown as Result); toast("Count submitted — variance revealed below"); router.refresh(); }
    });
  }

  return (
    <Card>
      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="c-item">Product</Label>
            <select id="c-item" value={id} onChange={(e) => { setId(e.target.value); setResult(null); }} className={sel} aria-label="Product">
              <option value="">Select a product…</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-loc">Location</Label>
            <select id="c-loc" value={location} onChange={(e) => { setLocation(e.target.value); setResult(null); }} className={sel} aria-label="Location">
              <option value="display">Display</option>
              <option value="store">Store</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-qty">Counted quantity {item ? <span className="text-xs font-normal text-muted-foreground">({item.uom})</span> : null}</Label>
            <Input id="c-qty" className="h-12 text-base" type="number" step="0.0001" min="0" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="count first, then enter" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-exp">Explanation <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="c-exp" className="h-12 text-base" value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="why is there a difference?" />
        </div>

        {result && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <div><div className="text-xs text-muted-foreground">System</div><div className="font-bold tabular-nums">{result.system_qty}</div></div>
              <div><div className="text-xs text-muted-foreground">Counted</div><div className="font-bold tabular-nums">{result.counted_qty}</div></div>
              <div><div className="text-xs text-muted-foreground">Variance</div><div className="font-bold tabular-nums">{result.variance_qty > 0 ? "+" : ""}{result.variance_qty} <span className="text-xs font-normal text-muted-foreground">({inr(result.variance_value)})</span></div></div>
            </div>
            <div className="mt-2">{result.variance_qty === 0 ? <Badge tone="green">Matches</Badge> : <Badge tone="amber">Needs owner/manager approval to adjust</Badge>}</div>
          </div>
        )}

        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button className="h-12 w-full text-base sm:w-auto" onClick={submit} disabled={pending}>{pending ? "Submitting…" : "Submit count"}</Button>
      </div>
    </Card>
  );
}
