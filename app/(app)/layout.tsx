import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/auth/session";
import { getNotifications } from "@/server/queries/notifications";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Toaster } from "@/components/ui/toaster";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getActiveContext();
  if (!ctx) redirect("/login");
  if (!ctx.org) redirect("/welcome"); // signed in but no business yet → finish onboarding

  const { items, unread } = await getNotifications(ctx.orgId!);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar orgName={ctx.org.name} branches={ctx.branches ?? []} activeBranch={ctx.branch?.id ?? null}
          notifications={items} unread={unread} />
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
