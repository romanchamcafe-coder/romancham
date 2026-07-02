import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { getPurchaseRegister, getPurchaseReadiness } from "@/server/queries/purchases";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OnboardingChecklist } from "@/components/ui/onboarding-checklist";
import { inr } from "@/lib/utils";

const modeLabel = (m: string | null) => (m === "petty_cash" ? "Petty Cash" : m === "credit" ? "Credit" : "—");

export default async function PurchasesPage() {
  const ctx = await getActiveContext();
  const rows: any[] = await getPurchaseRegister(ctx!.orgId!, ctx!.branch?.id ?? null);

  if (rows.length === 0) {
    const ready = await getPurchaseReadiness(ctx!.orgId!);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Purchases</h1>
          <Link href="/purchases/new"><Button>+ New Purchase</Button></Link>
        </div>
        <OnboardingChecklist
          title="Let's record your first purchase"
          description="Purchases feed your inventory, FIFO costing and GST. Complete these steps to get started."
          steps={[
            { title: "Add the items you buy", description: "Create your purchase items (raw materials, packaging) under Ingredients.", href: "/masters/ingredients?type=purchase", cta: "Add items", done: ready.ingredients > 0 },
            { title: "Add a vendor", description: "Add at least one supplier so GST can auto-split and pricing can pre-fill.", href: "/masters/vendors", cta: "Add vendor", done: ready.vendors > 0 },
            { title: "Record a purchase bill", description: "Enter a bill with its line items — stock and costs update automatically.", href: "/purchases/new", cta: "New purchase", done: false },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Purchases</h1>
        <Link href="/purchases/new"><Button>+ New Purchase</Button></Link>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Petty cash/Credit</th>
              <th className="px-3 py-2 font-medium">Vendor</th>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Invoice No</th>
              <th className="px-3 py-2 font-medium">Bill Date</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">UOM</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Per pcs</th>
              <th className="px-3 py-2 text-right font-medium">Without GST</th>
              <th className="px-3 py-2 text-right font-medium">With GST</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = r.purchases || {};
              return (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-2">
                    <Badge tone={p.payment_mode === "petty_cash" ? "green" : "amber"}>{modeLabel(p.payment_mode)}</Badge>
                  </td>
                  <td className="px-3 py-2">{p.vendors?.name ?? "—"}</td>
                  <td className="px-3 py-2">{p.branches?.name ?? "—"}</td>
                  <td className="px-3 py-2">{p.bill_no ?? "—"}</td>
                  <td className="px-3 py-2">{p.bill_date ?? "—"}</td>
                  <td className="px-3 py-2">{r.category ?? "—"}</td>
                  <td className="px-3 py-2 font-medium">{r.ingredients?.name ?? "—"}</td>
                  <td className="px-3 py-2">{r.uom ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.qty}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{inr(r.rate)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{inr(Number(r.qty) * Number(r.rate))}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{inr(r.line_total)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">No purchases yet. Click &quot;New Purchase&quot; to record your first bill.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
