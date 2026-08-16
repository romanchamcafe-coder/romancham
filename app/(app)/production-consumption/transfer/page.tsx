import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { getTransferScreen } from "@/server/queries/pnc";
import { Card, CardContent } from "@/components/ui/card";
import { TransferForm } from "./transfer-form";

export const metadata: Metadata = pageMetadata({ title: "Stock Transfer", description: "Move finished stock from Store to Display using FIFO batch allocation.", path: "/production-consumption/transfer" });

export default async function TransferPage() {
  const ctx = await getActiveContext();
  const { items, repeat } = await getTransferScreen(ctx!.orgId!, ctx!.branch?.id ?? null);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/production-consumption" className="text-xs text-muted-foreground hover:underline">← Production &amp; Consumption</Link>
        <h1 className="text-xl font-semibold">Stock Transfer</h1>
        <p className="text-sm text-muted-foreground">Move finished stock <b>Store → Display</b>. The oldest batch is moved first (FIFO), so nothing sits ageing in the back.</p>
      </div>

      {items.every((i) => i.store <= 0) ? (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">
          Nothing in Store to transfer yet. Record a batch in <Link href="/production-consumption/production" className="text-primary underline">Production Log</Link> first.
        </CardContent></Card>
      ) : (
        <TransferForm items={items} repeat={repeat} />
      )}
    </div>
  );
}
