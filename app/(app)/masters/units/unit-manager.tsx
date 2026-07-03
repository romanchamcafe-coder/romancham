"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUnit, updateUnit, archiveUnit } from "@/server/actions/units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/lib/toast";
import { Pencil, Trash2, Check, X, Ruler } from "lucide-react";

type Unit = { id: string; name: string; abbr: string };

export function UnitManager({ rows }: { rows: Unit[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [abbr, setAbbr] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eAbbr, setEAbbr] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmRow = rows.find((r) => r.id === confirmId);

  const add = () => {
    if (!name.trim() || !abbr.trim()) { toast("Name and short form are required", "error"); return; }
    start(async () => {
      const res = await createUnit(name, abbr);
      if (res.error) toast(res.error, "error");
      else { toast("Unit added"); setName(""); setAbbr(""); router.refresh(); }
    });
  };
  const save = (id: string) => {
    if (!eName.trim() || !eAbbr.trim()) { toast("Name and short form are required", "error"); return; }
    start(async () => {
      const res = await updateUnit(id, eName, eAbbr);
      if (res.error) toast(res.error, "error");
      else { toast("Unit updated"); setEditId(null); router.refresh(); }
    });
  };
  const remove = (id: string) => {
    start(async () => {
      const res = await archiveUnit(id);
      if (res.error) toast(res.error, "error");
      else { toast("Unit deleted"); setConfirmId(null); router.refresh(); }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="unit-name">Unit name</Label>
          <Input id="unit-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kilogram" className="w-56" aria-label="Unit name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit-abbr">Short form</Label>
          <Input id="unit-abbr" value={abbr} onChange={(e) => setAbbr(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="e.g. kg" className="w-32" aria-label="Unit short form" />
        </div>
        <Button onClick={add} disabled={pending}>{pending ? "Adding…" : "Add UOM"}</Button>
      </div>

      {rows.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={<Ruler className="h-8 w-8" />} title="No units yet" description="Add measurement units like kg, g, ltr or pcs above." />
        </Card>
      ) : (
        <Card>
          <Table>
            <THead><TR><TH>Unit</TH><TH>Short</TH><TH className="text-right">Actions</TH></TR></THead>
            <TBody>
              {rows.map((u) => (
                <TR key={u.id}>
                  <TD className="font-medium">
                    {editId === u.id
                      ? <Input value={eName} onChange={(e) => setEName(e.target.value)} autoFocus className="w-48" aria-label={`Edit name for ${u.name}`} />
                      : u.name}
                  </TD>
                  <TD>
                    {editId === u.id
                      ? <Input value={eAbbr} onChange={(e) => setEAbbr(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(u.id); } if (e.key === "Escape") setEditId(null); }} className="w-24" aria-label={`Edit short form for ${u.name}`} />
                      : u.abbr}
                  </TD>
                  <TD className="text-right">
                    {editId === u.id ? (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => save(u.id)} disabled={pending} aria-label="Save"><Check className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditId(null)} aria-label="Cancel"><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditId(u.id); setEName(u.name); setEAbbr(u.abbr); }} aria-label={`Edit ${u.name}`}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmId(u.id)} aria-label={`Delete ${u.name}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <ConfirmDialog
        open={!!confirmId}
        title={confirmRow ? `Delete ${confirmRow.name}?` : "Delete unit?"}
        description="This cannot be undone. Items already assigned to this unit will lose their unit label."
        confirmLabel="Delete"
        destructive
        busy={pending}
        onConfirm={() => confirmId && remove(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}
