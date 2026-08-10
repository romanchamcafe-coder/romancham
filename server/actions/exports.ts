"use server";
import { getActiveContext } from "@/lib/auth/session";
import { getSalesRegister, type SalesFilters } from "@/server/queries/sales";
import { getPurchaseRegister, type PurchaseFilters } from "@/server/queries/purchases";

const EXPORT_CAP = 20000;

function csvCell(v: any) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const SALES_COLS: [string, string][] = [
  ["date_raw", "Date"], ["location", "Location"], ["invoice_no", "Invoice No."], ["payment_type", "Payment Type"],
  ["order_type", "Order Type"], ["area", "Area"], ["item_name", "Item Name"], ["price", "Price"], ["qty", "Qty."],
  ["without_gst", "without GST"], ["discount", "Discount"], ["tax", "Tax"], ["final_total", "Final Total"],
  ["status", "Status"], ["table_no", "Table No."], ["server_name", "Server Name"], ["covers", "Covers"],
  ["variation", "Variation"], ["category", "Category"], ["group_name", "Group Name"], ["hsn", "HSN"],
  ["phone", "Phone"], ["customer_name", "Name"], ["address", "Address"], ["gst", "GST"], ["assign_to", "Assign To"],
  ["non_taxable", "Non Taxable"], ["cgst_rate", "C GST Rate"], ["cgst_amount", "C GST Amount"],
  ["sgst_rate", "S GST Rate"], ["sgst_amount", "S GST Amount"],
];

const PURCHASE_COLS: [string, string][] = [
  ["payment_mode", "Petty cash/Credit"], ["vendor", "Vendor"], ["location", "Location"], ["bill_no", "Invoice No"],
  ["bill_date", "Bill Date"], ["category", "Category"], ["product", "Product"],
  ["purchase_uom", "Packaging"], ["pack_qty", "Purchase Qty"], ["pack_size", "Pack Size"], ["pack_unit", "Pack Unit"],
  ["total_qty", "Total Qty"], ["base_uom", "Base UOM"], ["unit_price", "Unit Price"],
  ["without_gst", "Without GST"], ["with_gst", "With GST"],
];

function toCsv(cols: [string, string][], rows: any[]) {
  const header = cols.map(([, label]) => csvCell(label)).join(",");
  const body = rows.map((r) => cols.map(([key]) => csvCell(r[key])).join(","));
  return [header, ...body].join("\r\n");
}

export async function exportSalesCsv(filters: SalesFilters): Promise<{ csv?: string; error?: string }> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const { rows } = await getSalesRegister(ctx.orgId, ctx.branch?.id ?? null, filters, 1, EXPORT_CAP);
  return { csv: toCsv(SALES_COLS, rows) };
}

export async function exportPurchasesCsv(filters: PurchaseFilters): Promise<{ csv?: string; error?: string }> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const { rows } = await getPurchaseRegister(ctx.orgId, ctx.branch?.id ?? null, filters, 1, EXPORT_CAP);
  return { csv: toCsv(PURCHASE_COLS, rows) };
}
