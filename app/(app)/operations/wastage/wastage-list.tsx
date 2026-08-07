"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteWastage } from "@/server/actions/operations";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { inr } from "@/lib/utils";
import { WASTAGE_REASON_LABEL } from "@/lib/ops/checklists";
import { Trash2 } from "lucide-react";

type Row = { id: string; occurred_on: string; item_name: string; qty: number; unit: string | null; reason: string; cost: number; note: string | null };

export function WastageList({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmRow = rows.find((r) => r.id === confirmId);

  const remove = (id: string) => start(async () => {
    const res = await deleteWastage(id);
    if (res?.error) toast(res.error, "error");
    else { toast("Removed"); setConfirmId(null); router.refresh(); }
  });

  if (rows.length === 0) {
    return <p className="rounded-xl border bg-card p-4 text-center text-sm text-muted-foreground">No wastage logged yet.</p>;
  }

  return (
    <>
      <div className="space-y-2">
        <p className="text-sm font-semibold">Recent</p>
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.item_name}</p>
              <p className="text-xs text-muted-foreground">
                {r.occurred_on} · {r.qty}{r.unit ? ` ${r.unit}` : ""} · {WASTAGE_REASON_LABEL[r.reason] ?? r.reason}
                {r.note ? ` · ${r.note}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold tabular-nums">{inr(r.cost)}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setConfirmId(r.id)} aria-label={`Delete ${r.item_name}`}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
      <ConfirmDialog
        open={!!confirmId}
        title="Delete this entry?"
        description={confirmRow ? `${confirmRow.item_name} (${inr(confirmRow.cost)}) will be removed.` : ""}
        confirmLabel="Delete"
        destructive
        busy={pending}
        onConfirm={() => confirmId && remove(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </>
  );
}
