import type { Metadata } from "next";
export const metadata: Metadata = { title: "Purchase Requests | Romancham" };
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getActiveContext } from "@/lib/auth/session";
import { getRequestFormData, getPurchaseRequests } from "@/server/queries/requests";
import { PRForm } from "./pr-form";
import { PRList } from "./pr-list";

export default async function PurchaseRequestsPage() {
  const ctx = await getActiveContext();
  const [{ items, vendors }, prs] = await Promise.all([
    getRequestFormData(ctx!.orgId!, ctx!.branch?.id ?? null),
    getPurchaseRequests(ctx!.orgId!, ctx!.branch?.id ?? null),
  ]);
  const canManage = ctx!.role === "owner" || ctx!.role === "manager";

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/operations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Operations
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Purchase requests</h1>
        <p className="text-sm text-muted-foreground">Ask to buy stock from a vendor. A manager approves, then it&apos;s ordered &amp; received.</p>
      </div>
      <PRForm items={items} vendors={vendors as any} />
      <PRList rows={prs as any} canManage={canManage} />
    </div>
  );
}
