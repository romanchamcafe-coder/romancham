"use client";
import { useActionState, useRef, useEffect, useState } from "react";
import { createIngredient } from "@/server/actions/ingredients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Opt = { id: string; name: string; abbr?: string };
const sel = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function IngredientForm({ categories, units, vendors }: { categories: Opt[]; units: Opt[]; vendors: Opt[] }) {
  const [state, action, pending] = useActionState(createIngredient, null);
  const ref = useRef<HTMLFormElement>(null);
  const [uomError, setUomError] = useState("");
  useEffect(() => { if (state?.ok) { ref.current?.reset(); setUomError(""); } }, [state]);
  return (
    <form ref={ref} action={action} className="rounded-lg border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5"><Label>Ingredient name</Label><Input name="name" required placeholder="e.g. Amul Butter / Chocolate Brownie" aria-label="Ingredient name" /></div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <select name="material_type" defaultValue="purchase" className={sel} aria-label="Ingredient type">
            <option value="purchase">Purchase (raw item you buy)</option>
            <option value="sales">Sales (product you sell)</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Fulfillment <span className="text-xs font-normal text-muted-foreground">(sales items)</span></Label>
          <select name="fulfillment" defaultValue="direct" className={sel} aria-label="Fulfillment type">
            <option value="direct">Made to order (deduct raw on sale)</option>
            <option value="stock">Made to stock (produce batches)</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <select name="category_id" className={sel} aria-label="Category"><option value="">—</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>UOM <span className="text-destructive">*</span></Label>
          <select
            name="base_unit_id"
            required
            aria-required="true"
            aria-invalid={!!uomError}
            aria-describedby={uomError ? "uom-error" : undefined}
            className={sel}
            aria-label="Unit of measure"
            onInvalid={(e) => { e.preventDefault(); setUomError("Please select a Unit of Measure (UOM)"); }}
            onChange={(e) => { if (e.target.value) setUomError(""); }}
          >
            <option value="">—</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}{u.abbr ? ` (${u.abbr})` : ""}</option>)}
          </select>
          {uomError && <p id="uom-error" className="text-sm text-destructive">{uomError}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Default vendor</Label>
          <select name="default_vendor_id" className={sel} aria-label="Default vendor"><option value="">—</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label>GST %</Label><Input name="default_gst_rate" type="number" step="0.01" placeholder="5" aria-label="Default GST rate percent" /></div>
        <div className="space-y-1.5"><Label>Reorder level</Label><Input name="reorder_level" type="number" step="0.0001" placeholder="0" aria-label="Reorder level" /></div>
        <div className="space-y-1.5"><Label>HSN code</Label><Input name="hsn_code" placeholder="optional" aria-label="HSN code" /></div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button disabled={pending}>{pending ? "Adding…" : "Add Item"}</Button>
      </div>
    </form>
  );
}
