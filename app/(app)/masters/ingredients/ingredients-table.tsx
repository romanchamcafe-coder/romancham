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

type Opt = { id: string; name: string; abbr?: string };
type Item = {
  id: string; name: string; material_type: string; category_id: string | null;
  base_unit_id: string | null; default_vendor_id: string | null; default_gst_rate: number | null;
  reorder_level: number | null; hsn_code: string | null; fulfillment: string | null;
  category_name: string; uom: string; vendor_name: string;
};
const typeLabel: Record<string, string> = { purchase: "Purchase", sales: "Sales", both: "Both" };
const sel = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const toForm = (i: Item): IngredientInput => ({
  name: i.name, material_type: i.material_type,
  category_id: i.category_id ?? "", base_unit_id: i.base_unit_id ?? "",
  default_vendor_id: i.default_vendor_id ?? "",
  default_gst_rate: String(i.default_gst_rate ?? 0), reorder_level: String(i.reorder_level ?? 0),
  hsn_code: i.hsn_code ?? "",
  fulfillment: i.fulfillment ?? "direct",
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
                <TD><Badge tone={i.material_type === "sales" ? "green" : i.material_type === "both" ? "amber" : "muted"}>{typeLabel[i.material_type] ?? i.material_type}</Badge></TD>
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
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ei-fulfil">Fulfillment <span className="text-xs font-normal text-muted-foreground">(sales items)</span></Label>
              <select id="ei-fulfil" className={sel} value={v.fulfillment} onChange={set("fulfillment")}>
                <option value="direct">Made to order (deduct raw on sale)</option>
                <option value="stock">Made to stock (produce batches)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ei-cat">Category</Label>
              <select id="ei-cat" className={sel} value={v.category_id} onChange={set("category_id")}>
                <option value="">—</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ei-uom">UOM <span className="text-destructive">*</span></Label>
              <select id="ei-uom" className={sel} value={v.base_unit_id} onChange={set("base_unit_id")} aria-required="true">
                <option value="">—</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}{u.abbr ? ` (${u.abbr})` : ""}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ei-vendor">Default vendor</Label>
              <select id="ei-vendor" className={sel} value={v.default_vendor_id} onChange={set("default_vendor_id")}>
                <option value="">—</option>
                {vendors.map((ve) => <option key={ve.id} value={ve.id}>{ve.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="ei-gst">GST %</Label><Input id="ei-gst" type="number" step="0.01" value={v.default_gst_rate} onChange={set("default_gst_rate")} /></div>
            <div className="space-y-1.5"><Label htmlFor="ei-reorder">Reorder level</Label><Input id="ei-reorder" type="number" step="0.0001" value={v.reorder_level} onChange={set("reorder_level")} /></div>
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
