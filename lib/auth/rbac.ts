export type Role = "owner" | "manager" | "staff" | "accountant";

const matrix: Record<string, Role[]> = {
  manage_org: ["owner"],
  manage_branches: ["owner"],
  manage_team: ["owner"],
  master_data: ["owner", "manager"],
  purchases: ["owner", "manager", "accountant"],
  payments: ["owner", "manager", "accountant"],
  sales: ["owner", "manager", "staff"],
  adjustments: ["owner", "manager"],
  expenses: ["owner", "manager", "accountant"],
  reports: ["owner", "manager", "accountant"],
};

export function can(role: Role | null | undefined, action: keyof typeof matrix) {
  if (!role) return false;
  return matrix[action]?.includes(role) ?? false;
}
