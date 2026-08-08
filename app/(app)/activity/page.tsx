import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/auth/session";
import { getActivity } from "@/server/queries/audit";
import { pageMetadata } from "@/lib/seo";
import { ActivityTable } from "./activity-table";

export const metadata: Metadata = pageMetadata({
  title: "Activity Log",
  description: "Immutable audit trail of every change across your workspace.",
  path: "/activity",
});

export default async function ActivityPage() {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) redirect("/dashboard");
  // Audit trail is an owner/admin tool.
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect("/dashboard");

  const rows = await getActivity(ctx.orgId, { limit: 500 });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Activity Log</h1>
        <p className="text-sm text-muted-foreground">
          A read-only, append-only record of who changed what, and when. Showing the latest {rows.length} events.
        </p>
      </div>
      <ActivityTable rows={rows} />
    </div>
  );
}
