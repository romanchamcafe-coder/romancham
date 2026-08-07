import type { Metadata } from "next";
export const metadata: Metadata = { title: "Wastage | Romancham" };
import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { getWastage, getWastageItems } from "@/server/queries/operations";
import { WastageForm } from "./wastage-form";
import { WastageList } from "./wastage-list";
import { ChevronLeft } from "lucide-react";

export default async function WastagePage() {
  const ctx = await getActiveContext();
  const [items, rows] = await Promise.all([
    getWastageItems(ctx!.orgId!),
    getWastage(ctx!.orgId!, ctx!.branch?.id ?? null),
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/operations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Operations
      </Link>
      <h1 className="text-xl font-semibold">Wastage <span className="text-sm font-normal text-muted-foreground">· {ctx!.branch?.name}</span></h1>
      <WastageForm items={items} />
      <WastageList rows={rows as any} />
    </div>
  );
}
