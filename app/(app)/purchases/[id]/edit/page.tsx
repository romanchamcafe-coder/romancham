import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveContext } from "@/lib/auth/session";
import { getPurchaseFormData, getPurchaseForEdit } from "@/server/queries/purchases";
import { PurchaseForm } from "../../new/purchase-form";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export const metadata: Metadata = pageMetadata({ title: "Edit Purchase", description: "Edit a purchase bill and its line items.", path: "/purchases" });

export default async function EditPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getActiveContext();
  const [{ vendors, ingredients, branches }, purchase] = await Promise.all([
    getPurchaseFormData(ctx!.orgId!),
    getPurchaseForEdit(ctx!.orgId!, id),
  ]);
  if (!purchase) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/purchases"><Button variant="outline" size="sm"><ChevronLeft className="h-4 w-4" /> Back</Button></Link>
        <h1 className="text-xl font-semibold">Edit Purchase</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Saving replaces this bill: the stock it added is reversed and re-posted with your changes.
      </p>
      <PurchaseForm
        vendors={vendors}
        ingredients={ingredients}
        branches={branches}
        defaultBranchId={ctx!.branch?.id ?? ""}
        mode="edit"
        purchaseId={purchase.id}
        initial={{
          vendor_id: purchase.vendor_id,
          branch_id: purchase.branch_id,
          payment_mode: purchase.payment_mode,
          bill_no: purchase.bill_no,
          bill_date: purchase.bill_date,
          lines: purchase.lines,
        }}
      />
    </div>
  );
}
