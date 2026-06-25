import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { getPurchaseFormData } from "@/server/queries/purchases";
import { PurchaseForm } from "./purchase-form";
import { Card, CardContent } from "@/components/ui/card";

export default async function NewPurchasePage() {
  const ctx = await getActiveContext();
  const { vendors, ingredients } = await getPurchaseFormData(ctx!.orgId!);

  if (vendors.length === 0 || ingredients.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">New Purchase</h1>
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">
          To record a purchase you first need at least one{" "}
          {vendors.length === 0 && <Link href="/masters/vendors" className="text-primary underline">vendor</Link>}
          {vendors.length === 0 && ingredients.length === 0 && " and one "}
          {ingredients.length === 0 && <Link href="/masters/ingredients" className="text-primary underline">ingredient</Link>}.
          Add them, then come back.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">New Purchase <span className="text-sm font-normal text-muted-foreground">· {ctx!.branch?.name}</span></h1>
      <PurchaseForm vendors={vendors} ingredients={ingredients} />
    </div>
  );
}
