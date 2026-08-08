// Client-safe report metadata & types (no server imports).

export type Report = {
  headers: string[];
  rows: (string | number)[][];
  currencyCols?: number[];
  totals?: (string | number)[];
  note?: string;
};

export const REPORT_DEFS = [
  { key: "sales_daily", label: "Sales — daily", group: "Sales" },
  { key: "sales_by_item", label: "Sales — by item (top/least)", group: "Sales" },
  { key: "purchases_by_vendor", label: "Purchases — by vendor", group: "Purchases" },
  { key: "expenses_by_category", label: "Expenses — by category", group: "Finance" },
  { key: "pnl", label: "Profit & Loss (with EBITDA)", group: "Finance" },
  { key: "inventory_valuation", label: "Inventory valuation", group: "Inventory" },
  { key: "wastage_by_reason", label: "Wastage — by reason", group: "Operations" },
  { key: "compliance", label: "Checklist & food-safety compliance", group: "Operations" },
] as const;

export type ReportKey = (typeof REPORT_DEFS)[number]["key"];
