import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { VendorForm } from "./vendor-form";

export default async function VendorsPage() {
  const ctx = await getActiveContext();
  const supabase = await createClient();
  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, name, gstin, state_code, phone, payment_terms_days")
    .eq("org_id", ctx!.orgId!)
    .order("name");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Vendors</h1>
      <VendorForm />
      <Card>
        <Table>
          <THead><TR><TH>Name</TH><TH>GSTIN</TH><TH>State</TH><TH>Phone</TH><TH>Terms</TH></TR></THead>
          <TBody>
            {(vendors ?? []).map((v) => (
              <TR key={v.id}>
                <TD className="font-medium">{v.name}</TD>
                <TD>{v.gstin ?? "—"}</TD>
                <TD>{v.state_code ?? "—"}</TD>
                <TD>{v.phone ?? "—"}</TD>
                <TD>{v.payment_terms_days} days</TD>
              </TR>
            ))}
            {(!vendors || vendors.length === 0) && <TR><TD colSpan={5} className="py-8 text-center text-muted-foreground">No vendors yet.</TD></TR>}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
