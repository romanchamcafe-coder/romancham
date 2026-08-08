"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTaskDone, deleteTask } from "@/server/actions/tasks";
import { TASK_TYPE_LABEL } from "@/lib/ops/tasks";
import type { TaskRow } from "@/server/queries/tasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/lib/toast";
import { Check, Trash2, Clock } from "lucide-react";

const dot: Record<string, string> = { critical: "bg-red-500", high: "bg-amber-500", medium: "bg-blue-500", low: "bg-slate-400" };
const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : null;

export function TaskList({ tasks }: { tasks: TaskRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const toggle = (id: string, done: boolean) => start(async () => {
    const res = await setTaskDone(id, done);
    if (res.error) toast(res.error, "error"); else router.refresh();
  });
  const remove = () => confirmId && start(async () => {
    const res = await deleteTask(confirmId);
    if (res.error) toast(res.error, "error");
    else { toast("Task deleted"); setConfirmId(null); router.refresh(); }
  });

  if (tasks.length === 0) {
    return <p className="rounded-lg border bg-muted/40 p-4 text-center text-sm text-muted-foreground">No tasks yet. Add one above.</p>;
  }

  const now = new Date().toISOString();

  return (
    <div className="space-y-2">
      {tasks.map((t) => {
        const done = !!t.completed_at;
        const overdue = !done && t.due_at && t.due_at < now;
        return (
          <div key={t.id} className={`flex items-start gap-3 rounded-lg border p-3 ${done ? "bg-muted/30 opacity-70" : "bg-card"}`}>
            <button
              onClick={() => toggle(t.id, !done)}
              disabled={pending}
              aria-label={done ? "Mark not done" : "Mark done"}
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${done ? "border-green-600 bg-green-600 text-white" : "border-input hover:border-primary"}`}
            >
              {done && <Check className="h-3.5 w-3.5" />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${dot[t.priority] ?? "bg-slate-400"}`} aria-hidden />
                <span className={`font-medium ${done ? "line-through" : ""}`}>{t.title}</span>
                <Badge tone="muted">{TASK_TYPE_LABEL[t.task_type] ?? t.task_type}</Badge>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                {t.assignee && <span>👤 {t.assignee}</span>}
                {t.due_at && (
                  <span className={overdue ? "font-medium text-red-600" : ""}>
                    <Clock className="mr-0.5 inline h-3 w-3" />{fmt(t.due_at)}{overdue ? " · overdue" : ""}
                  </span>
                )}
                {t.note && <span className="truncate">📝 {t.note}</span>}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setConfirmId(t.id)} disabled={pending} aria-label="Delete task">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      })}

      <ConfirmDialog
        open={!!confirmId}
        title="Delete this task?"
        description="This removes the task permanently."
        confirmLabel="Delete"
        destructive
        busy={pending}
        onConfirm={remove}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}
