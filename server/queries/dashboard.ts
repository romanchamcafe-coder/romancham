import { createClient } from "@/lib/supabase/server";

export async function getDashboard(orgId: string, branchId: string | null, from: string, to: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_metrics", {
    p_org: orgId, p_branch: branchId, p_from: from, p_to: to,
  });
  if (error) throw new Error(error.message);
  return data as DashboardMetrics;
}

export type DashboardMetrics = {
  revenue: number; purchases: number; expenses: number; cogs: number;
  food_cost_pct: number; gross_profit: number; net_profit: number;
  top_sellers: { name: string; qty: number; amount: number }[];
  least_sellers: { name: string; qty: number; amount: number }[];
  low_stock: { name: string; qty: number; reorder_level: number }[];
  daily_trend: { d: string; revenue: number }[];
  branch_perf: { name: string; revenue: number }[];
};
