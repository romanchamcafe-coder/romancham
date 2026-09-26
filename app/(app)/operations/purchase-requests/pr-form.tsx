"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPurchaseRequest } from "@/server/actions/requests";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ItemsPicker, type PickRow } from "@/components/ops/items-picker";
import type { ReqItem } from "@/server/queries/requests";
import { SearchSelect } from "@/components/ui/search-select";

type Vendor = { id: string; name: string };
const sel = "h-11 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function PRForm({ items, vendors }: { items: ReqItem[]; vendors: Vendor[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<PickRow[]>([{ ingredient_id: "", qty: "" }]);
  const [vendorId, setVendorId] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    setErr(null);
    const clean = rows.filter((r) => r.ingredient_id && Number(r.qty) > 0);
    if (clean.length === 0) { setErr("Add at least one item with a quantity"); return; }
    start(async () => {
      const res = await createPurchaseRequest(vendorId || undefined, clean, note);
      if (res?.error) { setErr(res.error); return; }
      toast("Purchase request sent");
      setRows([{ ingredient_id: "", qty: "" }]); setVendorId(""); setNote("");
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="mb-3 text-sm font-semibold">New purchase request</p>
      <ItemsPicker items={items} rows={rows} setRows={setRows} />
      <div className="mt-3 grid gap-3">
        <div className="space-y-1.5">
          <Label>Vendor <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
          <SearchSelect options={vendors.map((v) => ({ value: v.id, label: v.name }))} value={vendorId} onChange={(v) => setVendorId(v)} ariaLabel="Vendor" placeholder="— choose vendor —" />
        </div>
        <div className="space-y-1.5">
          <Label>Note <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. urgent" className="h-11" />
        </div>
      </div>
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      <Button className="mt-3 h-12 w-full text-base" onClick={submit} disabled={pending}>{pending ? "Sending…" : "Send request"}</Button>
    </div>
  );
}
