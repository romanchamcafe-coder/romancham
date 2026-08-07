import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getActiveContext } from "@/lib/auth/session";
import { getSettings, getTeam } from "@/server/queries/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BranchForm } from "./branch-form";
import { BranchManager } from "./branch-manager";
import { OrgSettingsForm } from "./org-settings-form";
import { TeamPanel } from "./team-panel";
import { BackupRestore } from "./backup-restore";

export const metadata: Metadata = pageMetadata({ title: "Settings", description: "Manage your organization, branches and team members.", path: "/settings/team" });

export default async function SettingsPage() {
  const ctx = await getActiveContext();
  const { org, branches } = await getSettings(ctx!.orgId!);
  const team = await getTeam(ctx!.orgId!);
  const canManage = ctx!.role === "owner" || ctx!.role === "admin";

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
          <TeamPanel
            members={team.members}
            invitations={team.invitations}
            branches={team.branches}
            currentUserId={ctx!.user.id}
            canManage={canManage}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Backup &amp; Restore</CardTitle></CardHeader>
        <CardContent>
          <BackupRestore canManage={ctx!.role === "owner"} />
        </CardContent>
      </Card>
    </div>
  );
}
