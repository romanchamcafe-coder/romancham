import { getActiveContext } from "@/lib/auth/session";
import { getSettings } from "@/server/queries/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BranchForm } from "./branch-form";
import { OrgSettingsForm } from "./org-settings-form";
import { TeamManager } from "./team-manager";

export default async function SettingsPage() {
  const ctx = await getActiveContext();
  const { org, branches, members } = await getSettings(ctx!.orgId!);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <Card>
        <CardHeader><CardTitle>Organization</CardTitle></CardHeader>
        <CardContent>
          <OrgSettingsForm org={org ?? {}} />
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
          <TeamManager
            members={(members ?? []).map((m: any) => ({ user_id: m.user_id, role: m.role, name: m.profiles?.full_name ?? "" }))}
            currentUserId={ctx!.user.id}
            canManage={ctx!.role === "owner"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
