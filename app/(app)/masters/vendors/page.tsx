import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { VendorManager } from "./vendor-manager";

export default async function VendorsPage() {
  const ctx = await getActiveContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendors").select("id, name, gstin, state_code, phone, email, payment_terms_days")
    .eq("org_id", ctx!.orgId!).eq("is_active", true).order("name");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Vendors</h1>
        <p className="text-sm text-muted-foreground">Suppliers you buy from. Used for GST auto-split and default pricing in Purchases.</p>
      </div>
      <VendorManager rows={data ?? []} />
    </div>
  );
}
