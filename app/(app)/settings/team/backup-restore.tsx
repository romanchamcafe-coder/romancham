"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/lib/toast";
import { Download, Upload } from "lucide-react";

export function BackupRestore({ canManage }: { canManage: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setConfirm(true); }
  };
  const cancel = () => {
    setConfirm(false); setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };
  const doRestore = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/restore", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { toast(j.error || "Restore failed", "error"); }
      else { toast(`Restored ${j.restored ?? 0} records — reloading…`); setTimeout(() => location.reload(), 1300); }
    } catch {
      toast("Restore failed", "error");
    } finally {
      setBusy(false); setConfirm(false); setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <a href="/api/backup" download>
          <Button variant="outline"><Download className="mr-1 h-4 w-4" aria-hidden /> Download full backup</Button>
        </a>
        <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={!canManage}>
          <Upload className="mr-1 h-4 w-4" aria-hidden /> Restore from backup
        </Button>
        <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} aria-label="Choose a backup file to restore" />
      </div>
      <p className="text-xs text-muted-foreground">
        <b>Download</b> saves your whole account — every sale, purchase, item, recipe, inventory record and setting — as one backup file on your computer.
        <b> Restore</b> loads a backup file back into your account (it updates matching records; it never deletes anything).
        {!canManage && " Only the owner can restore."}
      </p>
      <ConfirmDialog
        open={confirm}
        title="Restore from this backup?"
        description={`This will load "${file?.name ?? ""}" into your account, updating existing records to match the backup. Nothing is deleted.`}
        confirmLabel="Restore"
        busy={busy}
        onConfirm={doRestore}
        onCancel={cancel}
      />
    </div>
  );
}
