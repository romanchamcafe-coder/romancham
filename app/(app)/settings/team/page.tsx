import { Card, CardContent } from "@/components/ui/card";

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Team & Settings</h1>
      <Card><CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">Invite members (Owner / Manager / Staff / Accountant), manage branches and organization settings.</p>
        <p className="mt-2 text-xs text-muted-foreground">The database, RLS and RPC for this module are already built (post_purchase / post_sale / FIFO ledger). This UI is the next batch.</p>
      </CardContent></Card>
    </div>
  );
}
