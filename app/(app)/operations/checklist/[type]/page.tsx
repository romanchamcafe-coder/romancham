import { notFound } from "next/navigation";
import { getActiveContext } from "@/lib/auth/session";
import { getChecklistRunToday } from "@/server/queries/operations";
import { CHECKLIST_MAP } from "@/lib/ops/checklists";
import { ChecklistRunner } from "./checklist-runner";

export default async function ChecklistPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const def = CHECKLIST_MAP[type];
  if (!def) notFound();
  const ctx = await getActiveContext();
  const run = await getChecklistRunToday(ctx!.orgId!, ctx!.branch?.id ?? null, type);
  return <ChecklistRunner def={def} existing={run as any} />;
}
