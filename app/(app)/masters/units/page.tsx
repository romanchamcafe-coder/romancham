import type { Metadata } from "next";
export const metadata: Metadata = { title: "Units (UOM) | Romancham" };
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { UnitManager } from "./unit-manager";

export default async function UnitsPage() {
  const ctx = await getActiveContext();
  const supabase = await createClient();
  const { data } = await supabase.from("units").select("id, name, abbr")
    .eq("org_id", ctx!.orgId!).eq("is_active", true).order("name");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Units of Measure (UOM)</h1>
        <p className="text-sm text-muted-foreground">Units used for items and purchases (kg, g, pcs, ltr…).</p>
      </div>
      <UnitManager rows={data ?? []} />
    </div>
  );
}
