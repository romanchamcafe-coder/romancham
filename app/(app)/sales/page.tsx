import { getActiveContext } from "@/lib/auth/session";
import { getSalesRegister } from "@/server/queries/sales";
import { SalesUpload } from "./sales-upload";
import { Card } from "@/components/ui/card";

const COLS: [string, string][] = [
  ["date_raw", "Date"], ["location", "Location"], ["invoice_no", "Invoice No."], ["payment_type", "Payment Type"],
  ["order_type", "Order Type"], ["area", "Area"], ["item_name", "Item Name"], ["price", "Price"], ["qty", "Qty."],
  ["without_gst", "without GST"], ["discount", "Discount"], ["tax", "Tax"], ["final_total", "Final Total"],
  ["status", "Status"], ["table_no", "Table No."], ["server_name", "Server Name"], ["covers", "Covers"],
  ["variation", "Variation"], ["category", "Category"], ["group_name", "Group Name"], ["hsn", "HSN"],
  ["phone", "Phone"], ["customer_name", "Name"], ["address", "Address"], ["gst", "GST"], ["assign_to", "Assign To"],
  ["non_taxable", "Non Taxable"], ["cgst_rate", "C GST Rate"], ["cgst_amount", "C GST Amount"],
  ["sgst_rate", "S GST Rate"], ["sgst_amount", "S GST Amount"],
];

export default async function SalesPage() {
  const ctx = await getActiveContext();
  const rows: any[] = await getSalesRegister(ctx!.orgId!, ctx!.branch?.id ?? null);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Sales</h1>
      <SalesUpload branchId={ctx!.branch?.id ?? ""} />
      <Card className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-xs">
          <thead className="border-b bg-muted/50 text-left">
            <tr>{COLS.map(([k, l]) => <th key={k} className="px-2 py-2 font-medium">{l}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                {COLS.map(([k]) => <td key={k} className="px-2 py-1.5">{r[k] ?? ""}</td>)}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={COLS.length} className="px-2 py-8 text-center text-muted-foreground">No sales uploaded yet. Upload your Petpooja CSV above.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
      {rows.length > 0 && <p className="text-xs text-muted-foreground">Showing latest {rows.length} rows.</p>}
    </div>
  );
}
