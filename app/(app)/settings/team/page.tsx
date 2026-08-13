import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getActiveContext } from "@/lib/auth/session";
import { getSettings, getTeam } from "@/server/queries/settings";
import { getBackups } from "@/server/queries/backups";
import { ensureScheduledBackups } from "@/lib/backup-core";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BranchForm } from "./branch-form";
import { BranchManager } from "./branch-manager";
import { OrgSettingsForm } from "./org-settings-form";
import { TeamPanel } from "./team-panel";
import { BackupRestore } from "./backup-restore";
import { BackupCenter } from "./backup-center";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const metadata: Metadata = pageMetadata({ title: "Settings", description: "Manage your organization, branches and team members.", path: "/settings/team" });

export default async function SettingsPage() {
  const ctx = await getActiveContext();
  const { org, branches } = await getSettings(ctx!.orgId!);
  const team = await getTeam(ctx!.orgId!);
  const canManage = ctx!.role === "owner" || ctx!.role === "admin";

  // Automatic daily/weekly/monthly snapshots on admin activity (non-blocking of correctness).
  if (canManage && ctx!.org) {
    const sb = await createClient();
    await ensureScheduledBackups(sb, ctx!.org, ctx!.user.id);
  }
  const backups = await getBackups(ctx!.orgId!);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <Card>
        <CardHeader><CardTitle>Preferences</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Appearance</p>
              <p className="text-sm text-muted-foreground">Choose light, dark, or match your device.</p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

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
        <CardHeader><CardTitle>Automatic Backups</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <BackupCenter
            rows={backups.rows}
            lastBackup={backups.lastBackup}
            dataSize={backups.dataSize}
            canManage={canManage}
            canRestore={ctx!.role === "owner"}
          />
          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium">Or use a backup file</p>
            <BackupRestore canManage={ctx!.role === "owner"} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
