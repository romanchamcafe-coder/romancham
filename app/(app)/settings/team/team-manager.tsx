"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMemberRole, removeMember } from "@/server/actions/team";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/lib/toast";
import { Trash2, Info } from "lucide-react";

type Member = { user_id: string; role: string; name: string };
const ROLES = ["owner", "manager", "accountant", "staff"];
const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60";

export function TeamManager({ members, currentUserId, canManage }: { members: Member[]; currentUserId: string; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmRow = members.find((m) => m.user_id === confirmId);

  const changeRole = (userId: string, role: string) => {
    start(async () => {
      const res = await updateMemberRole(userId, role);
      if (res.error) toast(res.error, "error");
      else { toast("Role updated"); router.refresh(); }
    });
  };
  const remove = (userId: string) => {
    start(async () => {
      const res = await removeMember(userId);
      if (res.error) toast(res.error, "error");
      else { toast("Member removed"); setConfirmId(null); router.refresh(); }
    });
  };

  return (
    <div className="space-y-4">
      <Table>
        <THead><TR><TH>Member</TH><TH>Role</TH><TH className="text-right">Actions</TH></TR></THead>
        <TBody>
          {members.map((m) => (
            <TR key={m.user_id}>
              <TD className="font-medium">
                {m.name || "Team member"}
                {m.user_id === currentUserId && <Badge tone="muted" className="ml-2">You</Badge>}
              </TD>
              <TD>
                {canManage ? (
                  <select className={sel} value={m.role} disabled={pending}
                    onChange={(e) => changeRole(m.user_id, e.target.value)}
                    aria-label={`Role for ${m.name || "team member"}`}>
                    {ROLES.map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
                  </select>
                ) : <span className="capitalize">{m.role}</span>}
              </TD>
              <TD className="text-right">
                {canManage && m.user_id !== currentUserId ? (
                  <Button size="sm" variant="ghost" onClick={() => setConfirmId(m.user_id)} aria-label={`Remove ${m.name || "team member"}`}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>Roles control access: <b>Owner</b> manages everything, <b>Manager</b> runs day-to-day, <b>Accountant</b> handles finances, <b>Staff</b> has limited access. Email invitations for new teammates are the next planned step.</span>
      </div>

      <ConfirmDialog
        open={!!confirmId}
        title="Remove team member?"
        description={confirmRow ? `${confirmRow.name || "This member"} will lose access to this organization. You can re-add them later.` : ""}
        confirmLabel="Remove"
        destructive
        busy={pending}
        onConfirm={() => confirmId && remove(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}
