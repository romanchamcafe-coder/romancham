import type { Metadata } from "next";
export const metadata: Metadata = { title: "Indents | Romancham" };
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getActiveContext } from "@/lib/auth/session";
import { getRequestFormData, getIndents } from "@/server/queries/requests";
import { IndentForm } from "./indent-form";
import { IndentList } from "./indent-list";

export default async function IndentsPage() {
  const ctx = await getActiveContext();
  const [{ items }, indents] = await Promise.all([
    getRequestFormData(ctx!.orgId!, ctx!.branch?.id ?? null),
    getIndents(ctx!.orgId!, ctx!.branch?.id ?? null),
  ]);
  const canManage = ctx!.role === "owner" || ctx!.role === "manager";

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/operations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Operations
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Indent requests</h1>
        <p className="text-sm text-muted-foreground">Request stock from the store — pick items, set quantities, send.</p>
      </div>
      <IndentForm items={items} />
      <IndentList rows={indents as any} canManage={canManage} />
    </div>
  );
}
