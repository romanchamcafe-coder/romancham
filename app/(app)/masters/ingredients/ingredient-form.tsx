"use client";
import { useActionState, useRef, useEffect } from "react";
import { createIngredient } from "@/server/actions/ingredients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Opt = { id: string; name: string; abbr?: string };
const sel = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function IngredientForm({ categories, units, vendors }: { categories: Opt[]; units: Opt[]; vendors: Opt[] }) {
  const [state, action, pending] = useActionState(createIngredient, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="rounded-lg border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5"><Label>Ingredient name</Label><Input name="name" required placeholder="e.g. Amul Butter / Chocolate Brownie" /></div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <select name="material_type" defaultValue="purchase" className={sel}>
            <option value="purchase">Purchase (raw item you buy)</option>
            <option value="sales">Sales (product you sell)</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <select name="category_id" className={sel}><option value="">—</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>UOM</Label>
          <select name="base_unit_id" className={sel}><option value="">—</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}{u.abbr ? ` (${u.abbr})` : ""}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Default vendor</Label>
          <select name="default_vendor_id" className={sel}><option value="">—</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label>GST %</Label><Input name="default_gst_rate" type="number" step="0.01" placeholder="5" /></div>
        <div className="space-y-1.5"><Label>Reorder level</Label><Input name="reorder_level" type="number" step="0.0001" placeholder="0" /></div>
        <div className="space-y-1.5"><Label>HSN code</Label><Input name="hsn_code" placeholder="optional" /></div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button disabled={pending}>{pending ? "Adding…" : "Add Item"}</Button>
      </div>
    </form>
  );
}
