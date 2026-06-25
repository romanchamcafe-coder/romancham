import { Card, CardContent } from "@/components/ui/card";

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Purchases</h1>
      <Card><CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">Record vendor bills with auto GST split (CGST/SGST vs IGST), bill upload and payment status. Posting a purchase creates inventory IN movements + FIFO cost layers.</p>
        <p className="mt-2 text-xs text-muted-foreground">The database, RLS and RPC for this module are already built (post_purchase / post_sale / FIFO ledger). This UI is the next batch.</p>
      </CardContent></Card>
    </div>
  );
}
