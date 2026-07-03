// Full-account backup: org-scoped data tables in FK-dependency order (parents first).
// Auth/system tables (profiles, memberships, invitations, audit_logs) are intentionally excluded.
export const RESTORE_ORDER = [
  "organizations",
  "branches",
  "categories",
  "units",
  "vendors",
  "ingredients",
  "vendor_ingredients",
  "menu_items",
  "recipes",
  "recipe_items",
  "purchases",
  "purchase_items",
  "payments",
  "pos_imports",
  "pos_sales",
  "sales",
  "sale_items",
  "inventory_movements",
  "inventory_cost_layers",
  "stock_adjustments",
  "stock_snapshots",
  "expenses",
  "notifications",
] as const;

export const BACKUP_TABLES = RESTORE_ORDER;
