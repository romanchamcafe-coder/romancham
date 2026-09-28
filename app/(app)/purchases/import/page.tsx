import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { getActiveContext } from "@/lib/auth/session";
import { getPurchaseFormData } from "@/server/queries/purchases";
import { PurchaseImport } from "./purchase-import";
import { ChevronLeft } from "lucide-react";

export const metadata: Metadata = pageMetadata({ title: "Import Purchases", description: "Upload purchase bills in bulk from an Excel or CSV file.", path: "/purchases/import" });

export default async function ImportPurchasesPage() {
  const ctx = await getActiveContext();
  const { vendors, ingredients, branches, units } = await getPurchaseFormData(ctx!.orgId!);
  return (
    <div className="space-y-4">
      <Link href="/purchases" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Purchases
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Import Purchases from Excel</h1>
        <p className="text-sm text-muted-foreground">Download the template, fill one row per product, upload, check the preview, then import.</p>
      </div>
      <PurchaseImport vendors={vendors} ingredients={ingredients} units={units} branches={branches} defaultBranchId={ctx!.branch?.id ?? ""} />
    </div>
  );
}
