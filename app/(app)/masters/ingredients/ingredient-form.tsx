"use client";
import { useActionState, useRef, useEffect, useMemo, useState } from "react";
import { createIngredient } from "@/server/actions/ingredients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";

type Opt = { id: string; name: string; abbr?: string };
export type ExistingItem = { name: string; type: string; uom: string };
const norm = (t: string) => t.trim().replace(/\s+/g, " ").toLowerCase();
const TYPE: Record<string, string> = { purchase: "Purchase", sales: "Sales", both: "Both", prep: "Prep" };
const sel = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function IngredientForm({ categories, units, vendors, existing = [] }: { categories: Opt[]; units: Opt[]; vendors: Opt[]; existing?: ExistingItem[] }) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const q = norm(name);
  const matches = useMemo(() => {
    if (q.length < 2) return [];
    const starts: ExistingItem[] = [], words: ExistingItem[] = [], contains: ExistingItem[] = [];
    for (const e of existing) {
      const n = norm(e.name);
      if (n.startsWith(q)) starts.push(e);
      else if (n.split(" ").some((w) => w.startsWith(q))) words.push(e);
      else if (n.includes(q)) contains.push(e);
    }
    return [...starts, ...words, ...contains];
  }, [q, existing]);
  const exact = existing.find((e) => norm(e.name) === q && q !== "");
  const [state, action, pending] = useActionState(createIngredient, null);
  const ref = useRef<HTMLFormElement>(null);
  const [uomError, setUomError] = useState("");
  const [type, setType] = useState("purchase");
  const isSales = type === "sales";
  const showFulfillment = type === "sales" || type === "both";
  useEffect(() => { if (state?.ok) { ref.current?.reset(); setUomError(""); setType("purchase"); setName(""); setOpen(false); } }, [state]);
  return (
    <form ref={ref} action={action} className="rounded-lg border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative space-y-1.5">
          <Label>Ingredient name</Label>
          <Input name="name" required autoComplete="off" placeholder="e.g. Amul Butter / Chocolate Brownie" aria-label="Ingredient name"
            value={name} onChange={(e) => { setName(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
            aria-invalid={!!exact} className={exact ? "border-destructive focus-visible:ring-destructive" : ""} />
          {exact && <p className="text-xs text-destructive">“{exact.name}” already exists — duplicates aren&apos;t allowed.</p>}
          {open && matches.length > 0 && (
            <div className="absolute left-0 top-full z-50 mt-1 w-[min(28rem,90vw)] rounded-md border bg-card p-1 shadow-lg">
              <p className="px-2 py-1 text-xs text-muted-foreground">{matches.length} existing item{matches.length === 1 ? "" : "s"} matching “{name.trim()}” — already in your list</p>
              <ul className="max-h-64 overflow-y-auto">
                {matches.slice(0, 50).map((m) => (
                  <li key={m.name + m.type} className={"flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm " + (norm(m.name) === q ? "bg-destructive/10" : "hover:bg-muted")}
                    onMouseDown={(e) => { e.preventDefault(); setOpen(false); }}>
                    <span className="truncate">{m.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{TYPE[m.type] ?? m.type}{m.uom ? ` · ${m.uom}` : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <select name="material_type" value={type} onChange={(e) => setType(e.target.value)} className={sel} aria-label="Ingredient type">
            <option value="purchase">Purchase (raw item you buy)</option>
            <option value="sales">Sales (product you sell)</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <SearchSelect options={categories.map((c) => ({ value: c.id, label: c.name }))} name="category_id" ariaLabel="Category" placeholder="—" emptyLabel="—" />
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
        {!isSales && (
          <div className="space-y-1.5">
            <Label>Default vendor</Label>
            <SearchSelect options={vendors.map((v) => ({ value: v.id, label: v.name }))} name="default_vendor_id" ariaLabel="Default vendor" placeholder="—" emptyLabel="—" />
          </div>
        )}
        {showFulfillment && (
          <div className="space-y-1.5">
            <Label>Fulfillment</Label>
            <select name="fulfillment" className={sel} defaultValue="direct" aria-label="Fulfillment">
              <option value="direct">Made to order (backflush on sale)</option>
              <option value="stock">Made to stock (batch-produced)</option>
            </select>
          </div>
        )}
        <div className="space-y-1.5"><Label>GST %</Label><Input name="default_gst_rate" type="number" step="0.01" placeholder="5" aria-label="Default GST rate percent" /></div>
        {!isSales && (
          <div className="space-y-1.5"><Label>Usable yield %</Label><Input name="yield_pct" type="number" min="1" max="100" step="0.1" placeholder="100" aria-label="Usable yield percent after trimming" /></div>
        )}
        {!isSales && (
          <div className="space-y-1.5"><Label>Reorder level</Label><Input name="reorder_level" type="number" step="0.0001" placeholder="0" aria-label="Reorder level" /></div>
        )}
        <div className="space-y-1.5"><Label>HSN code</Label><Input name="hsn_code" placeholder="optional" aria-label="HSN code" /></div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button disabled={pending || !!exact}>{pending ? "Adding…" : "Add Item"}</Button>
      </div>
    </form>
  );
}
