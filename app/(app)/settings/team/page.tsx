import { getActiveContext } from "@/lib/auth/session";
import { getSettings } from "@/server/queries/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { BranchForm } from "./branch-form";
import { Users } from "lucide-react";

export default async function SettingsPage() {
  const ctx = await getActiveContext();
  const { org, branches } = await getSettings(ctx!.orgId!);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <Card>
        <CardHeader><CardTitle>Organization</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <div><span className="text-muted-foreground">Name:</span> <b>{org?.name}</b></div>
            <div><span className="text-muted-foreground">Plan:</span> {org?.plan ?? "free"}</div>
            <div><span className="text-muted-foreground">GSTIN:</span> {org?.gstin ?? "—"}</div>
            <div><span className="text-muted-foreground">State code:</span> {org?.state_code ?? "—"}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Branches / Locations</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <BranchForm />
          <Table>
            <THead><TR><TH>Branch</TH><TH>State</TH><TH>Status</TH></TR></THead>
            <TBody>
              {branches.map((b: any) => (
                <TR key={b.id}>
                  <TD className="font-medium">{b.name}</TD>
                  <TD>{b.state_code ?? "—"}</TD>
                  <TD>{b.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="muted">Inactive</Badge>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Team</CardTitle></CardHeader>
        <CardContent>
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="Team management — coming soon"
            description="Invite managers, accountants and staff with role-based access. This feature is being finalised and will be available shortly."
          />
        </CardContent>
      </Card>
    </div>
  );
}
