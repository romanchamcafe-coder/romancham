import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { UnitForm } from "./unit-form";

export default async function UnitsPage() {
  const ctx = await getActiveContext();
  const supabase = await createClient();
  const { data } = await supabase.from("units").select("id, name, abbr").eq("org_id", ctx!.orgId!).order("name");
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Units of Measure (UOM)</h1>
      <p className="text-sm text-muted-foreground">Units used for items and purchases (kg, g, pcs, ltr…).</p>
      <UnitForm />
      <Card>
        <Table>
          <THead><TR><TH>Unit</TH><TH>Short</TH></TR></THead>
          <TBody>
            {(data ?? []).map((u) => <TR key={u.id}><TD className="font-medium">{u.name}</TD><TD>{u.abbr}</TD></TR>)}
            {(!data || data.length === 0) && <TR><TD colSpan={2} className="py-8 text-center text-muted-foreground">No units yet.</TD></TR>}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
