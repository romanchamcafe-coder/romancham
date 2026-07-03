"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCategory, updateCategory, archiveCategory } from "@/server/actions/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/lib/toast";
import { Pencil, Trash2, Check, X, Tag } from "lucide-react";

type Cat = { id: string; name: string };

export function CategoryManager({ rows, type = "ingredient" }: { rows: Cat[]; type?: "ingredient" | "expense" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmRow = rows.find((r) => r.id === confirmId);

  const add = () => {
    const name = newName.trim();
    if (!name) { toast("Enter a category name", "error"); return; }
    start(async () => {
      const res = await createCategory(name, type);
      if (res.error) toast(res.error, "error");
      else { toast("Category added"); setNewName(""); router.refresh(); }
    });
  };
  const save = (id: string) => {
    if (!editName.trim()) { toast("Name is required", "error"); return; }
    start(async () => {
      const res = await updateCategory(id, editName, type);
      if (res.error) toast(res.error, "error");
      else { toast("Category updated"); setEditId(null); router.refresh(); }
    });
  };
  const remove = (id: string) => {
    start(async () => {
      const res = await archiveCategory(id);
      if (res.error) toast(res.error, "error");
      else { toast("Category deleted"); setConfirmId(null); router.refresh(); }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="new-category">Category name</Label>
          <Input
            id="new-category"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder={type === "expense" ? "e.g. Rent, Salaries" : "e.g. Dairy, Packaging"}
            className="w-64"
            aria-label="New category name"
          />
        </div>
        <Button onClick={add} disabled={pending}>{pending ? "Adding…" : "Add Category"}</Button>
      </div>

      {rows.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={<Tag className="h-8 w-8" />} title="No categories yet" description="Add your first category above to start organising items." />
        </Card>
      ) : (
        <Card>
          <Table>
            <THead><TR><TH>Category</TH><TH className="text-right">Actions</TH></TR></THead>
            <TBody>
              {rows.map((c) => (
                <TR key={c.id}>
                  <TD className="font-medium">
                    {editId === c.id ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(c.id); } if (e.key === "Escape") setEditId(null); }}
                        autoFocus
                        className="w-64"
                        aria-label={`Edit ${c.name}`}
                      />
                    ) : c.name}
                  </TD>
                  <TD className="text-right">
                    {editId === c.id ? (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => save(c.id)} disabled={pending} aria-label="Save"><Check className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditId(null)} aria-label="Cancel"><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditId(c.id); setEditName(c.name); }} aria-label={`Edit ${c.name}`}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmId(c.id)} aria-label={`Delete ${c.name}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
        title={confirmRow ? `Delete ${confirmRow.name}?` : "Delete category?"}
        description={type === "expense"
          ? "This cannot be undone. Expenses already assigned to this category will lose their category label."
          : "This cannot be undone. Items already assigned to this category will lose their category label."}
        confirmLabel="Delete"
        destructive
        busy={pending}
        onConfirm={() => confirmId && remove(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}
