import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Toaster } from "@/components/ui/toaster";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getActiveContext();
  if (!ctx) redirect("/login");
  if (!ctx.org) redirect("/login"); // no org yet — could route to an onboarding page

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar orgName={ctx.org.name} branches={ctx.branches ?? []} activeBranch={ctx.branch?.id ?? null} />
        <main className="flex-1 p-6">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
