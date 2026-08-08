"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { TASK_TYPES, TASK_PRIORITIES } from "@/lib/ops/tasks";
import type { ActionState } from "@/lib/types";

export type TaskInput = {
  title: string; task_type: string; priority: string;
  assigned_to?: string | null; due_at?: string | null; note?: string | null;
};

export async function createTask(input: TaskInput): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId || !ctx.branch) return { error: "No active organization or branch" };
  const title = (input.title || "").trim();
  if (!title) return { error: "Task title is required" };
  const task_type = TASK_TYPES.some((t) => t.key === input.task_type) ? input.task_type : "other";
  const priority = (TASK_PRIORITIES as readonly string[]).includes(input.priority) ? input.priority : "medium";

  const supabase = await createClient();
  const { error } = await supabase.from("ops_tasks").insert({
    org_id: ctx.orgId, branch_id: ctx.branch.id, title, task_type, priority,
    assigned_to: input.assigned_to || null,
    due_at: input.due_at ? new Date(input.due_at).toISOString() : null,
    note: (input.note || "").trim() || null,
    created_by: ctx.user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/operations/tasks");
  revalidatePath("/operations");
  return { ok: true };
}

export async function setTaskDone(id: string, done: boolean): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const supabase = await createClient();
  const { error } = await supabase.from("ops_tasks").update({
    completed_at: done ? new Date().toISOString() : null,
    completed_by: done ? ctx.user.id : null,
  }).eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { error: error.message };
  revalidatePath("/operations/tasks");
  revalidatePath("/operations");
  return { ok: true };
}

export async function deleteTask(id: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const supabase = await createClient();
  const { error } = await supabase.from("ops_tasks").delete().eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { error: error.message };
  revalidatePath("/operations/tasks");
  revalidatePath("/operations");
  return { ok: true };
}
