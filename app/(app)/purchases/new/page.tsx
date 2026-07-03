import type { Metadata } from "next";
import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { getPurchaseFormData } from "@/server/queries/purchases";
import { PurchaseForm } from "./purchase-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "New Purchase | Romancham" };

export default async function NewPurchasePage() {
  const ctx = await getActiveContext();
  const { vendors, ingredients, branches } = await getPurchaseFormData(ctx!.orgId!);

  if (vendors.length === 0 || ingredients.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">New Purchase</h1>
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">
          To record a purchase you first need at least one{" "}
          {vendors.length === 0 && <Link href="/masters/vendors" className="text-primary underline">vendor</Link>}
          {vendors.length === 0 && ingredients.length === 0 && " and one "}
          {ingredients.length === 0 && <Link href="/masters/ingredients" className="text-primary underline">product</Link>}.
          Add them, then come back.
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/masters/vendors"><Button variant="outline" size="sm">→ Add a Vendor</Button></Link>
            <Link href="/masters/ingredients"><Button variant="outline" size="sm">→ Add an Ingredient</Button></Link>
          </div>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">New Purchase</h1>
      <PurchaseForm vendors={vendors} ingredients={ingredients} branches={branches} defaultBranchId={ctx!.branch?.id ?? ""} />
    </div>
  );
}
