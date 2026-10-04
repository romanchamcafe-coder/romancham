"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateIngredient, removeIngredient, type IngredientInput } from "@/server/actions/ingredients";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/lib/toast";
import { Pencil, Trash2 } from "lucide-react";
import { SearchSelect } from "@/components/ui/search-select";

type Opt = { id: string; name: string; abbr?: string };
type Item = {
  id: string; name: string; material_type: string; category_id: string | null;
  base_unit_id: string | null; default_vendor_id: string | null; default_gst_rate: number | null;
  reorder_level: number | null; hsn_code: string | null; fulfillment: string | null; yield_pct?: number | null; pack_content_qty?: number | null; pack_content_unit_id?: string | null;
  category_name: string; uom: string; vendor_name: string;
};
const typeLabel: Record<string, string> = { purchase: "Purchase", sales: "Sales", both: "Both", prep: "Prep" };
const sel = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const toForm = (i: Item): IngredientInput => ({
  name: i.name, material_type: i.material_type,
  category_id: i.category_id ?? "", base_unit_id: i.base_unit_id ?? "",
  default_vendor_id: i.default_vendor_id ?? "",
  default_gst_rate: String(i.default_gst_rate ?? 0), reorder_level: String(i.reorder_level ?? 0),
  hsn_code: i.hsn_code ?? "",
  fulfillment: i.fulfillment ?? "direct",
  yield_pct: String(i.yield_pct ?? 100),
  pack_content_qty: i.pack_content_qty != null ? String(i.pack_content_qty) : "",
  pack_content_unit_id: i.pack_content_unit_id ?? "",
});

export function IngredientsTable({ items, categories, units, vendors }: {
  items: Item[]; categories: Opt[]; units: Opt[]; vendors: Opt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editId, setEditId] = useState<string | null>(null);
  const [v, setV] = useState<IngredientInput | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmRow = items.find((i) => i.id === confirmId);
  const set = (k: keyof IngredientInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => (s ? { ...s, [k]: e.target.value } : s));

  const openEdit = (i: Item) => { setV(toForm(i)); setEditId(i.id); };
  const save = () => {
    if (!editId || !v) return;
    if (!v.name.trim()) { toast("Item name is required", "error"); return; }
    if (!v.base_unit_id) { toast("Please select a Unit of Measure (UOM)", "error"); return; }
    start(async () => {
      const res = await updateIngredient(editId, v);
      if (res.error) toast(res.error, "error");
      else { toast("Ingredient updated"); setEditId(null); setV(null); router.refresh(); }
    });
  };
  const remove = (id: string) => {
    start(async () => {
      const res = await removeIngredient(id);
      if (res.error) toast(res.error, "error");
      else { toast("Ingredient removed"); setConfirmId(null); router.refresh(); }
    });
  };

  return (
    <>
      <Card className="overflow-x-auto">
        <Table>
          <THead><TR><TH>Ingredient</TH><TH>Type</TH><TH>Category</TH><TH>UOM</TH><TH>GST %</TH><TH>Reorder</TH><TH>Default Vendor</TH><TH className="text-right">Actions</TH></TR></THead>
          <TBody>
            {items.map((i) => (
              <TR key={i.id}>
                <TD className="font-medium">{i.name}</TD>
                <TD>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge tone={i.material_type === "sales" ? "green" : i.material_type === "both" || i.material_type === "prep" ? "amber" : "muted"}>{typeLabel[i.material_type] ?? i.material_type}</Badge>
                    {i.material_type !== "sales" && i.material_type !== "prep" && i.yield_pct != null && Number(i.yield_pct) < 100 && <Badge tone="muted">{Number(i.yield_pct)}% usable</Badge>}
                    {(i.material_type === "sales" || i.material_type === "both") && i.fulfillment === "stock" && <Badge tone="muted">Made to stock</Badge>}
                  </div>
                </TD>
                <TD>{i.category_name}</TD>
                <TD>{i.uom}</TD>
                <TD>{i.default_gst_rate ?? 0}%</TD>
                <TD>{i.reorder_level ?? 0}</TD>
                <TD>{i.vendor_name}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(i)} aria-label={`Edit ${i.name}`}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmId(i.id)} aria-label={`Remove ${i.name}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TD>
              </TR>
            ))}
            {items.length === 0 && <TR><TD colSpan={8} className="py-8 text-center text-muted-foreground">No items yet.</TD></TR>}
          </TBody>
        </Table>
      </Card>

      <Dialog
        open={!!editId && !!v}
        onClose={() => { setEditId(null); setV(null); }}
        title="Edit ingredient"
        footer={
          <>
            <Button variant="outline" onClick={() => { setEditId(null); setV(null); }} disabled={pending}>Cancel</Button>
            <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
          </>
        }
      >
        {v && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="ei-name">Ingredient name</Label><Input id="ei-name" value={v.name} onChange={set("name")} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="ei-type">Type</Label>
              <select id="ei-type" className={sel} value={v.material_type} onChange={set("material_type")}>
                <option value="purchase">Purchase (raw item you buy)</option>
                <option value="sales">Sales (product you sell)</option>
                <option value="both">Both</option>
                {v.material_type === "prep" && <option value="prep">Prep / Component (managed in Recipes)</option>}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ei-cat">Category</Label>
              <SearchSelect options={categories.map((c) => ({ value: c.id, label: c.name }))} value={v.category_id} onChange={(x) => setV((st) => (st ? { ...st, category_id: x } : st))} id="ei-cat" placeholder="—" emptyLabel="—" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ei-uom">UOM <span className="text-destructive">*</span></Label>
              <SearchSelect options={units.map((u) => ({ value: u.id, label: `${u.name}${u.abbr ? ` (${u.abbr})` : ""}` }))} value={v.base_unit_id} onChange={(x) => setV((st) => (st ? { ...st, base_unit_id: x } : st))} id="ei-uom" placeholder="—" emptyLabel="—" />
            </div>
            {v.material_type !== "sales" && (
              <div className="space-y-1.5">
                <Label htmlFor="ei-vendor">Default vendor</Label>
                <SearchSelect options={vendors.map((ve) => ({ value: ve.id, label: ve.name }))} value={v.default_vendor_id} onChange={(x) => setV((st) => (st ? { ...st, default_vendor_id: x } : st))} id="ei-vendor" placeholder="—" emptyLabel="—" />
              </div>
            )}
            {(v.material_type === "sales" || v.material_type === "both") && (
              <div className="space-y-1.5">
                <Label htmlFor="ei-fulfillment">Fulfillment</Label>
                <select id="ei-fulfillment" className={sel} value={v.fulfillment} onChange={set("fulfillment")}>
                  <option value="direct">Made to order (backflush on sale)</option>
                  <option value="stock">Made to stock (batch-produced)</option>
                </select>
              </div>
            )}
            <div className="space-y-1.5"><Label htmlFor="ei-gst">GST %</Label><Input id="ei-gst" type="number" step="0.01" value={v.default_gst_rate} onChange={set("default_gst_rate")} /></div>
            {v.material_type !== "sales" && (
              <div className="space-y-1.5"><Label htmlFor="ei-reorder">Reorder level</Label><Input id="ei-reorder" type="number" step="0.0001" value={v.reorder_level} onChange={set("reorder_level")} /></div>
            )}
            {(v.material_type === "purchase" || v.material_type === "both") && (
              <div className="space-y-1.5">
                <Label htmlFor="ei-yield">Usable yield %</Label>
                <Input id="ei-yield" type="number" min="1" max="100" step="0.1" value={v.yield_pct ?? "100"} onChange={set("yield_pct")} />
                <p className="text-xs text-muted-foreground">After trimming/peeling. e.g. 1 kg strawberries → 900 g usable = 90%. Recipe cost & stock use this.</p>
              </div>
            )}
            {(v.material_type === "purchase" || v.material_type === "both") && (
              <div className="space-y-1.5">
                <Label htmlFor="ei-pack">Pack size (for recipes)</Label>
                <div className="flex items-center gap-2 text-sm">
                  <span className="shrink-0">1 {units.find((u) => u.id === v.base_unit_id)?.abbr ?? "unit"} =</span>
                  <Input id="ei-pack" type="number" min="0" step="0.01" className="w-24" value={v.pack_content_qty ?? ""} onChange={set("pack_content_qty")} placeholder="400" />
                  <select className={sel + " w-24"} value={v.pack_content_unit_id ?? ""} onChange={set("pack_content_unit_id")} aria-label="Pack content unit">
                    <option value="">unit</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.abbr ?? u.name}</option>)}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground">Only if you buy it per pack/qty but use grams/ml in recipes (e.g. 1 tub = 400 gms).</p>
              </div>
            )}
            <div className="space-y-1.5"><Label htmlFor="ei-hsn">HSN code</Label><Input id="ei-hsn" value={v.hsn_code} onChange={set("hsn_code")} placeholder="optional" /></div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!confirmId}
        title={confirmRow ? `Remove ${confirmRow.name}?` : "Remove ingredient?"}
        description="This hides the ingredient from lists and dropdowns. Past purchases, recipes and sales that used it keep their history."
        confirmLabel="Remove"
        destructive
        busy={pending}
        onConfirm={() => confirmId && remove(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </>
  );
}
