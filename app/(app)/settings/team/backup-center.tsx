"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBackup, downloadBackup, restoreFromBackup } from "@/server/actions/backups";
import type { BackupRow } from "@/server/queries/backups";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/lib/toast";
import { DatabaseBackup, Download, RotateCcw, Clock, HardDrive } from "lucide-react";

function pretty(n: number) {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"]; const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
}
const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never";
const kindTone = (k: string): "green" | "amber" | "muted" => k === "manual" ? "amber" : k === "monthly" ? "green" : "muted";

export function BackupCenter({
  rows, lastBackup, dataSize, canManage, canRestore,
}: {
  rows: BackupRow[]; lastBackup: string | null; dataSize: number; canManage: boolean; canRestore: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [restoreId, setRestoreId] = useState<string | null>(null);

  const backupNow = () => start(async () => {
    const res = await createBackup();
    if (res.error) toast(res.error, "error");
    else { toast(`Backup created (${pretty(res.size ?? 0)})`); router.refresh(); }
  });

  const download = (id: string) => start(async () => {
    const res = await downloadBackup(id);
    if (res.error || !res.json) { toast(res.error ?? "Download failed", "error"); return; }
    const url = URL.createObjectURL(new Blob([res.json], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = res.name ?? "backup.json"; a.click();
    URL.revokeObjectURL(url);
  });

  const doRestore = () => restoreId && start(async () => {
    const res = await restoreFromBackup(restoreId);
    if (res.error) { toast(res.error, "error"); setRestoreId(null); return; }
    toast(`Restored ${res.restored ?? 0} records — reloading…`);
    setRestoreId(null);
    setTimeout(() => location.reload(), 1200);
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" aria-hidden /> Last backup</div>
          <p className="mt-1 text-sm font-semibold">{fmt(lastBackup)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><HardDrive className="h-3.5 w-3.5" aria-hidden /> Data size</div>
          <p className="mt-1 text-sm font-semibold">{pretty(dataSize)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><DatabaseBackup className="h-3.5 w-3.5" aria-hidden /> Restore points</div>
          <p className="mt-1 text-sm font-semibold">{rows.length}</p>
        </div>
      </div>

      {canManage && (
        <Button onClick={backupNow} disabled={pending}>
          <DatabaseBackup className="h-4 w-4" /> {pending ? "Backing up…" : "Back up now"}
        </Button>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          No backups yet. Daily, weekly and monthly snapshots are created automatically when an owner or admin uses the app — or create one now.
        </p>
      ) : (
        <Table>
          <THead><TR><TH>Type</TH><TH>When</TH><TH>Records</TH><TH>Size</TH><TH>By</TH><TH className="text-right">Actions</TH></TR></THead>
          <TBody>
            {rows.map((b) => (
              <TR key={b.id}>
                <TD><Badge tone={kindTone(b.kind)} className="capitalize">{b.kind}</Badge></TD>
                <TD className="whitespace-nowrap text-xs text-muted-foreground">{fmt(b.created_at)}</TD>
                <TD className="text-xs">{b.records.toLocaleString("en-IN")}</TD>
                <TD className="text-xs text-muted-foreground">{pretty(b.size_bytes)}</TD>
                <TD className="text-xs text-muted-foreground">{b.created_by_name}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => download(b.id)} disabled={pending} aria-label="Download backup">
                      <Download className="h-4 w-4" />
                    </Button>
                    {canRestore && (
                      <Button size="sm" variant="ghost" onClick={() => setRestoreId(b.id)} disabled={pending} aria-label="Restore this backup">
                        <RotateCcw className="h-4 w-4 text-primary" />
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <ConfirmDialog
        open={!!restoreId}
        title="Restore this backup?"
        description="This loads the selected restore point back into your account, updating existing records to match. Nothing is deleted. This can take a moment."
        confirmLabel="Restore"
        busy={pending}
        onConfirm={doRestore}
        onCancel={() => setRestoreId(null)}
      />
    </div>
  );
}
