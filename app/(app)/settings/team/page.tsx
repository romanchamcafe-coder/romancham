import type { Metadata } from "next";
import { getActiveContext } from "@/lib/auth/session";
import { getSettings } from "@/server/queries/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BranchForm } from "./branch-form";
import { BranchManager } from "./branch-manager";
import { OrgSettingsForm } from "./org-settings-form";
import { TeamManager } from "./team-manager";
import { InviteTeammate } from "./invite-teammate";

export const metadata: Metadata = { title: "Settings | Romancham" };

export default async function SettingsPage() {
  const ctx = await getActiveContext();
  const { org, branches, members } = await getSettings(ctx!.orgId!);

  const queried = (members ?? []).map((m: any) => ({ user_id: m.user_id, role: m.role, name: m.profiles?.full_name ?? "" }));
  const teamMembers = queried.some((m) => m.user_id === ctx!.user.id)
    ? queried
    : [{ user_id: ctx!.user.id, role: ctx!.role ?? "owner", name: ctx!.user.email ?? "" }, ...queried];

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
          <BranchManager branches={(branches ?? []).map((b: any) => ({ id: b.id, name: b.name, state_code: b.state_code ?? null, is_active: !!b.is_active }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Team</CardTitle></CardHeader>
        <CardContent>
          <TeamManager
            members={teamMembers}
            currentUserId={ctx!.user.id}
            canManage={ctx!.role === "owner"}
          />
          <InviteTeammate />
        </CardContent>
      </Card>
    </div>
  );
}
