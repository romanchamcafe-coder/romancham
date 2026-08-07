import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveContext } from "@/lib/auth/session";
import { getChecklistRunToday } from "@/server/queries/operations";
import { CHECKLIST_MAP } from "@/lib/ops/checklists";
import { pageMetadata } from "@/lib/seo";
import { ChecklistRunner } from "./checklist-runner";

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }): Promise<Metadata> {
  const { type } = await params;
  const def = CHECKLIST_MAP[type];
  const title = def ? `${def.title} checklist` : "Checklist";
  return pageMetadata({
    title,
    description: "Run a daily operational checklist and record a compliance score.",
    path: `/operations/checklist/${type}`,
  });
}

export default async function ChecklistPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const def = CHECKLIST_MAP[type];
  if (!def) notFound();
  const ctx = await getActiveContext();
  const run = await getChecklistRunToday(ctx!.orgId!, ctx!.branch?.id ?? null, type);
  return <ChecklistRunner def={def} existing={run as any} />;
}
