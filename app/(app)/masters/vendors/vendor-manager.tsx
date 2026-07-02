"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createVendor, updateVendor, archiveVendor } from "@/server/actions/vendors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/lib/toast";
import { Pencil, Trash2, Truck } from "lucide-react";

type Vendor = {
  id: string; name: string; gstin: string | null; state_code: string | null;
  phone: string | null; email: string | null; payment_terms_days: number | null;
};
type FormVals = { name: string; gstin: string; state_code: string; phone: string; email: string; payment_terms_days: string };
const empty: FormVals = { name: "", gstin: "", state_code: "", phone: "", email: "", payment_terms_days: "0" };

function toInput(v: FormVals) {
  return {
    name: v.name.trim(),
    gstin: v.gstin.trim() || undefined,
    state_code: v.state_code.trim() || undefined,
    phone: v.phone.trim() || undefined,
    email: v.email.trim(),
    payment_terms_days: Number(v.payment_terms_days) || 0,
  };
}

export function VendorManager({ rows }: { rows: Vendor[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [vals, setVals] = useState<FormVals>(empty);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmRow = rows.find((r) => r.id === confirmId);

  const openAdd = () => { setVals(empty); setEditId(null); setAddOpen(true); };
  const openEdit = (v: Vendor) => {
    setVals({
      name: v.name, gstin: v.gstin ?? "", state_code: v.state_code ?? "",
      phone: v.phone ?? "", email: v.email ?? "", payment_terms_days: String(v.payment_terms_days ?? 0),
    });
    setEditId(v.id); setAddOpen(true);
  };
  const submit = () => {
    if (!vals.name.trim()) { toast("Vendor name is required", "error"); return; }
    start(async () => {
      const res = editId ? await updateVendor(editId, toInput(vals)) : await createVendor(toInput(vals));
      if (res.error) toast(res.error, "error");
      else { toast(editId ? "Vendor updated" : "Vendor added"); setAddOpen(false); setEditId(null); router.refresh(); }
    });
  };
  const remove = (id: string) => {
    start(async () => {
      const res = await archiveVendor(id);
      if (res.error) toast(res.error, "error");
      else { toast("Vendor deleted"); setConfirmId(null); router.refresh(); }
    });
  };

  const set = (k: keyof FormVals) => (e: React.ChangeEvent<HTMLInputElement>) => setVals((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd}>+ Add Vendor</Button>
      </div>

      {rows.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={<Truck className="h-8 w-8" />} title="No vendors yet"
            description="Add the suppliers you buy from. Vendors power GST auto-split and default pricing in Purchases." />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <THead><TR><TH>Name</TH><TH>GSTIN</TH><TH>State</TH><TH>Phone</TH><TH>Email</TH><TH>Terms</TH><TH className="text-right">Actions</TH></TR></THead>
            <TBody>
              {rows.map((v) => (
                <TR key={v.id}>
                  <TD className="font-medium">{v.name}</TD>
                  <TD>{v.gstin ?? "—"}</TD>
                  <TD>{v.state_code ?? "—"}</TD>
                  <TD>{v.phone ?? "—"}</TD>
                  <TD>{v.email ?? "—"}</TD>
                  <TD>{v.payment_terms_days ?? 0} days</TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(v)} aria-label={`Edit ${v.name}`}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmId(v.id)} aria-label={`Delete ${v.name}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="vendor-modal-title" onClick={() => setAddOpen(false)}>
          <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 id="vendor-modal-title" className="text-lg font-semibold">{editId ? "Edit vendor" : "Add vendor"}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="v-name">Vendor name</Label><Input id="v-name" value={vals.name} onChange={set("name")} placeholder="Vendor name" autoFocus /></div>
              <div className="space-y-1.5"><Label htmlFor="v-gstin">GSTIN</Label><Input id="v-gstin" value={vals.gstin} onChange={set("gstin")} placeholder="GSTIN" /></div>
              <div className="space-y-1.5"><Label htmlFor="v-state">State code</Label><Input id="v-state" value={vals.state_code} onChange={set("state_code")} placeholder="e.g. 33" /></div>
              <div className="space-y-1.5"><Label htmlFor="v-phone">Phone</Label><Input id="v-phone" value={vals.phone} onChange={set("phone")} placeholder="Phone" /></div>
              <div className="space-y-1.5"><Label htmlFor="v-email">Email</Label><Input id="v-email" type="email" value={vals.email} onChange={set("email")} placeholder="Email" /></div>
              <div className="space-y-1.5"><Label htmlFor="v-terms">Payment terms (days)</Label><Input id="v-terms" type="number" min={0} value={vals.payment_terms_days} onChange={set("payment_terms_days")} /></div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)} disabled={pending}>Cancel</Button>
              <Button onClick={submit} disabled={pending}>{pending ? "Saving…" : editId ? "Save changes" : "Add vendor"}</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmId}
        title="Delete vendor?"
        description={confirmRow ? `"${confirmRow.name}" will be removed from your active vendors. Past purchases keep their vendor name.` : ""}
        confirmLabel="Delete"
        destructive
        busy={pending}
        onConfirm={() => confirmId && remove(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}
