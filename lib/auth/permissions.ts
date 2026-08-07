// ============================================================
// Romancham — role & permission model (Phase 1)
// Single source of truth for the 8 SaaS roles, their labels, and a
// resource × action permission matrix used for UI gating and server checks.
// Legacy roles (manager, accountant, staff) are mapped onto the new tiers so
// existing memberships keep working unchanged.
// ============================================================

export const ROLES = [
  "owner",
  "admin",
  "branch_manager",
  "kitchen",
  "store",
  "cashier",
  "accounts",
  "viewer",
] as const;
export type Role = (typeof ROLES)[number];

// Every role value that can appear in the DB (new + legacy).
export type AnyRole = Role | "manager" | "accountant" | "staff";

export const ROLE_LABELS: Record<AnyRole, string> = {
  owner: "Owner",
  admin: "Admin",
  branch_manager: "Branch Manager",
  kitchen: "Kitchen",
  store: "Store",
  cashier: "Cashier",
  accounts: "Accounts",
  viewer: "Viewer",
  // legacy
  manager: "Branch Manager",
  accountant: "Accounts",
  staff: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full control, including billing and ownership transfer.",
  admin: "Manage the whole workspace, team and settings.",
  branch_manager: "Run day-to-day operations for their branches.",
  kitchen: "Recipes, production and kitchen checklists.",
  store: "Inventory, indents and purchase requests.",
  cashier: "Sales, cash reconciliation and daily operations.",
  accounts: "Finance, expenses and reports.",
  viewer: "Read-only access to dashboards and reports.",
};

/** Normalise any stored role (incl. legacy) to a canonical tier. */
export function normalizeRole(role: string | null | undefined): Role {
  switch (role) {
    case "manager":
      return "branch_manager";
    case "accountant":
      return "accounts";
    case "staff":
      return "viewer";
    default:
      return (ROLES as readonly string[]).includes(role ?? "") ? (role as Role) : "viewer";
  }
}

export type Resource =
  | "settings"
  | "inventory"
  | "finance"
  | "reports"
  | "recipes"
  | "purchases"
  | "operations"
  | "branches";

export type Action = "create" | "read" | "update" | "delete" | "export";

const ALL: Action[] = ["create", "read", "update", "delete", "export"];
const RE: Action[] = ["read", "export"];
const R: Action[] = ["read"];
const CRU: Action[] = ["create", "read", "update"];
const CRUE: Action[] = ["create", "read", "update", "export"];

// resource → (role → allowed actions). Missing entry = no access.
const MATRIX: Record<Resource, Partial<Record<Role, Action[]>>> = {
  settings: { owner: ALL, admin: ALL, branch_manager: R },
  branches: { owner: ALL, admin: ALL, branch_manager: R, store: R, cashier: R, kitchen: R, accounts: R },
  inventory: { owner: ALL, admin: ALL, branch_manager: ALL, store: ALL, kitchen: R, cashier: R, accounts: RE, viewer: R },
  finance: { owner: ALL, admin: ALL, branch_manager: RE, accounts: ALL, cashier: RE, viewer: R },
  reports: { owner: ALL, admin: ALL, branch_manager: RE, accounts: RE, cashier: RE, store: RE, kitchen: RE, viewer: RE },
  recipes: { owner: ALL, admin: ALL, branch_manager: CRUE, kitchen: CRUE, store: R, accounts: R, viewer: R },
  purchases: { owner: ALL, admin: ALL, branch_manager: CRUE, store: CRU, accounts: RE, cashier: R, viewer: R },
  operations: { owner: ALL, admin: ALL, branch_manager: ALL, kitchen: CRU, store: CRU, cashier: CRU, accounts: RE, viewer: R },
};

/** Can `role` perform `action` on `resource`? Accepts legacy roles too. */
export function can(role: string | null | undefined, resource: Resource, action: Action): boolean {
  if (!role) return false;
  const r = normalizeRole(role);
  if (r === "owner" || r === "admin") return true;
  return MATRIX[resource]?.[r]?.includes(action) ?? false;
}
