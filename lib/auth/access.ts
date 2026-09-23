// ============================================================
// Route-level access control by role.
// The Kitchen login can operate the whole app EXCEPT anything that reveals
// money: Sales, all P&L / finance, cash reconciliation, Reports and the AI
// Analyst. Settings/Team is locked too — otherwise a kitchen user could just
// change their own role and lift the restriction.
// Owners/admins/branch-managers keep full access.
// ============================================================
import { normalizeRole } from "./permissions";

const KITCHEN_BLOCKED = [
  "/sales",
  "/reports",
  "/ai",
  "/operations/finance",
  "/operations/cash",
  "/settings",
] as const;

// The union of every restricted prefix (used to short-circuit checks).
export const RESTRICTED_PREFIXES: readonly string[] = KITCHEN_BLOCKED;

// Roles that run the business and see everything.
const FULL_ACCESS = new Set(["owner", "admin", "branch_manager"]);

function blockedFor(role: string | null | undefined): readonly string[] {
  const r = normalizeRole(role);
  if (FULL_ACCESS.has(r)) return [];
  if (r === "kitchen") return KITCHEN_BLOCKED;
  return []; // other roles unchanged for now
}

const matches = (prefix: string, path: string) =>
  path === prefix || path.startsWith(prefix + "/");

/** True if `role` must be redirected away from `path`. */
export function isPathBlocked(role: string | null | undefined, path: string): boolean {
  return blockedFor(role).some((p) => matches(p, path));
}

/** True if a nav item with this href should be hidden from `role`. */
export function isNavHidden(role: string | null | undefined, href: string): boolean {
  return blockedFor(role).some((p) => matches(p, href));
}
