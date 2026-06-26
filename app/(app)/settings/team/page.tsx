import { getActiveContext } from "@/lib/auth/session";
import { getSettings } from "@/server/queries/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BranchForm } from "./branch-form";

const roleTone: Record<string, "green" | "amber" | "muted" | "red"> = { owner: "green", manager: "amber", accountant: "muted", staff: "muted" };

export default async function SettingsPage() {
  const ctx = await getActiveContext();
  const { org, branches, members } = await getSettings(ctx!.orgId!);

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
        <CardContent className="space-y-3">
          <Table>
            <THead><TR><TH>Member</TH><TH>Role</TH></TR></THead>
            <TBody>
              {members.map((m: any, idx: number) => (
                <TR key={idx}>
                  <TD className="font-medium">{m.profiles?.full_name ?? "—"} {m.user_id === ctx!.user.id && <span className="text-xs text-muted-foreground">(you)</span>}</TD>
                  <TD><Badge tone={roleTone[m.role] ?? "muted"}>{m.role}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <p className="text-xs text-muted-foreground">Inviting new members by email needs an email provider — tell me when you want team logins and I&apos;ll set it up.</p>
        </CardContent>
      </Card>
    </div>
  );
}
