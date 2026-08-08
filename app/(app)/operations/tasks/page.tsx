import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getActiveContext } from "@/lib/auth/session";
import { getTasks, getTaskStats, getAssignees } from "@/server/queries/tasks";
import { pageMetadata } from "@/lib/seo";
import { Card, CardContent } from "@/components/ui/card";
import { TaskForm } from "./task-form";
import { TaskList } from "./task-list";

export const metadata: Metadata = pageMetadata({
  title: "Tasks",
  description: "Assign and track operational tasks with due times, priority and completion.",
  path: "/operations/tasks",
});

export default async function TasksPage() {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return null;
  const [tasks, stats, assignees] = await Promise.all([
    getTasks(ctx.orgId, ctx.branch?.id ?? null),
    getTaskStats(ctx.orgId, ctx.branch?.id ?? null),
    getAssignees(ctx.orgId),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/operations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Operations
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Tasks <span className="text-sm font-normal text-muted-foreground">· {ctx.branch?.name}</span></h1>
        <p className="text-sm text-muted-foreground">Assign jobs, set due times and track completion.</p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Completion</span>
            <span className="text-muted-foreground">{stats.done}/{stats.total} done · {stats.open} open{stats.overdue ? ` · ${stats.overdue} overdue` : ""}</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${stats.pct}%` }} />
          </div>
          <p className="mt-1 text-right text-xs font-semibold">{stats.pct}%</p>
        </CardContent>
      </Card>

      <TaskForm assignees={assignees} />
      <TaskList tasks={tasks} />
    </div>
  );
}
