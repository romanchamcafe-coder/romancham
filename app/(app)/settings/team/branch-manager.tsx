"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBranch, deactivateBranch } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/lib/toast";
import { Pencil, Trash2, Check, X } from "lucide-react";

type Branch = { id: string; name: string; state_code: string | null; is_active: boolean };

export function BranchManager({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmRow = branches.find((b) => b.id === confirmId);
  const activeCount = branches.filter((b) => b.is_active).length;
  const onlyOne = activeCount <= 1;

  const save = (id: string) => {
    if (!editName.trim()) { toast("Branch name is required", "error"); return; }
    start(async () => {
      const res = await updateBranch(id, editName);
      if (res.error) toast(res.error, "error");
      else { toast("Branch updated"); setEditId(null); router.refresh(); }
    });
  };
  const remove = (id: string) => {
    start(async () => {
      const res = await deactivateBranch(id);
      if (res.error) toast(res.error, "error");
      else { toast("Branch deactivated"); setConfirmId(null); router.refresh(); }
    });
  };

  return (
    <>
      <Table>
        <THead><TR><TH>Branch</TH><TH>State</TH><TH>Status</TH><TH className="text-right">Actions</TH></TR></THead>
        <TBody>
          {branches.map((b) => {
            const disabled = onlyOne && b.is_active;
            return (
              <TR key={b.id}>
                <TD className="font-medium">
                  {editId === b.id
                    ? <Input value={editName} onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(b.id); } if (e.key === "Escape") setEditId(null); }}
                        autoFocus className="w-56" aria-label={`Edit ${b.name}`} />
                    : b.name}
                </TD>
                <TD>{b.state_code ?? "—"}</TD>
                <TD>{b.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="muted">Inactive</Badge>}</TD>
                <TD className="text-right">
                  {editId === b.id ? (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => save(b.id)} disabled={pending} aria-label="Save">
                        <Check className="h-4 w-4" />
                      </Button>
                      <button onClick={() => setEditId(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                    </div>
                  ) : b.is_active ? (
                    disabled ? (
                      <Tooltip content="You need at least one active branch" side="left">
                        <div className="flex justify-end gap-1 opacity-40">
                          <span className="p-1"><Pencil className="h-4 w-4" /></span>
                          <span className="p-1"><Trash2 className="h-4 w-4" /></span>
                        </div>
                      </Tooltip>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditId(b.id); setEditName(b.name); }} aria-label={`Edit ${b.name}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmId(b.id)} aria-label={`Deactivate ${b.name}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      <ConfirmDialog
        open={!!confirmId}
        title="Deactivate this branch?"
        description={confirmRow ? `This will hide ${confirmRow.name} from all reports. Existing data will not be deleted.` : ""}
        confirmLabel="Deactivate"
        destructive
        busy={pending}
        onConfirm={() => confirmId && remove(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </>
  );
}
