"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTask } from "@/server/actions/tasks";
import { TASK_TYPES, TASK_PRIORITIES } from "@/lib/ops/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { Plus } from "lucide-react";

const sel = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TaskForm({ assignees }: { assignees: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("opening");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [note, setNote] = useState("");

  const submit = () => {
    if (!title.trim()) { toast("Enter a task title", "error"); return; }
    start(async () => {
      const res = await createTask({ title, task_type: type, priority, assigned_to: assignedTo || null, due_at: dueAt || null, note });
      if (res.error) { toast(res.error, "error"); return; }
      toast("Task added");
      setTitle(""); setNote(""); setDueAt("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      <h3 className="text-sm font-semibold">New task</h3>
      <div className="space-y-1.5">
        <Label htmlFor="t-title">Title</Label>
        <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Deep-clean the coffee machine" className="h-11" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="t-type">Type</Label>
          <select id="t-type" className={sel} value={type} onChange={(e) => setType(e.target.value)}>
            {TASK_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-priority">Priority</Label>
          <select id="t-priority" className={sel} value={priority} onChange={(e) => setPriority(e.target.value)}>
            {TASK_PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p[0].toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-assignee">Assign to</Label>
          <select id="t-assignee" className={sel} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">Unassigned</option>
            {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-due">Due</Label>
          <Input id="t-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="h-10" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="t-note">Note <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
        <Input id="t-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any details" />
      </div>
      <Button onClick={submit} disabled={pending}><Plus className="h-4 w-4" /> {pending ? "Adding…" : "Add task"}</Button>
    </div>
  );
}
