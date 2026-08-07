"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  inviteTeammate, resendInvitation, cancelInvitation,
  updateMemberRole, setMemberStatus, setMemberBranches, removeMember,
} from "@/server/actions/team";
import { ROLES, ROLE_LABELS } from "@/lib/auth/permissions";
import type { TeamMember, TeamInvite } from "@/server/queries/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/lib/toast";
import { Trash2, Copy, Send, Pause, Play, Mail } from "lucide-react";

type Branch = { id: string; name: string };
const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never";

function copy(text: string) {
  navigator.clipboard?.writeText(text).then(() => toast("Invite link copied")).catch(() => toast("Copy failed", "error"));
}

export function TeamPanel({
  members, invitations, branches, currentUserId, canManage,
}: {
  members: TeamMember[]; invitations: TeamInvite[]; branches: Branch[];
  currentUserId: string; canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmRow = members.find((m) => m.user_id === confirmId);

  // invite form
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("branch_manager");
  const [invBranches, setInvBranches] = useState<string[]>([]);
  const [lastLink, setLastLink] = useState<string | null>(null);

  const pendingInvites = invitations.filter((i) => i.status === "pending");
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";

  const run = (fn: () => Promise<any>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res?.error) toast(res.error, "error");
      else { if (res?.link) setLastLink(res.link); toast(ok); router.refresh(); }
    });

  const sendInvite = () => {
    if (!email.trim()) { toast("Enter an email", "error"); return; }
    run(() => inviteTeammate({ email, role, branchIds: invBranches }), "Invitation ready — share the link");
    setEmail("");
  };

  return (
    <div className="space-y-6">
      {/* Invite */}
      {canManage && (
        <div className="space-y-3 rounded-lg border border-dashed p-4">
          <h3 className="text-sm font-semibold">Invite a teammate</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">Email</Label>
              <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-role">Role</Label>
              <select id="inv-role" className={sel + " w-full"} value={role} onChange={(e) => setRole(e.target.value)} aria-label="Invite role">
                {ROLES.filter((r) => r !== "owner").map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={sendInvite} disabled={pending}>
                <Send className="h-4 w-4" /> Send invite
              </Button>
            </div>
          </div>
          {branches.length > 1 && (
            <fieldset className="space-y-1.5">
              <legend className="text-xs font-medium text-muted-foreground">Branch access (optional — managers/admins see all)</legend>
              <div className="flex flex-wrap gap-2">
                {branches.map((b) => {
                  const on = invBranches.includes(b.id);
                  return (
                    <label key={b.id} className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                      <input type="checkbox" className="sr-only" checked={on}
                        onChange={() => setInvBranches((s) => on ? s.filter((x) => x !== b.id) : [...s, b.id])} />
                      {b.name}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          {lastLink && (
            <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2 text-xs">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{lastLink}</span>
              <Button size="sm" variant="outline" onClick={() => copy(lastLink)}><Copy className="h-3.5 w-3.5" /> Copy</Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Email delivery is coming soon — for now, share the generated link with your teammate. Links expire in 7 days.</p>
        </div>
      )}

      {/* Members */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Members ({members.length})</h3>
        <Table>
          <THead><TR>
            <TH>Member</TH><TH>Role</TH><TH>Branches</TH><TH>Status</TH><TH>Last login</TH><TH>Added</TH><TH className="text-right">Actions</TH>
          </TR></THead>
          <TBody>
            {members.map((m) => {
              const isSelf = m.user_id === currentUserId;
              const suspended = m.status === "suspended";
              return (
                <TR key={m.user_id}>
                  <TD className="font-medium">{m.name || "Team member"}{isSelf && <Badge tone="muted" className="ml-2">You</Badge>}</TD>
                  <TD>
                    {canManage && !isSelf ? (
                      <select className={sel} value={ROLES.includes(m.role as any) ? m.role : "viewer"} disabled={pending}
                        onChange={(e) => run(() => updateMemberRole(m.user_id, e.target.value), "Role updated")}
                        aria-label={`Role for ${m.name || "member"}`}>
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    ) : <span>{ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] ?? m.role}</span>}
                  </TD>
                  <TD className="text-xs text-muted-foreground">
                    {m.branchIds.length === 0 ? "All" : m.branchIds.map(branchName).join(", ")}
                  </TD>
                  <TD><Badge tone={suspended ? "amber" : "green"}>{suspended ? "Suspended" : "Active"}</Badge></TD>
                  <TD className="text-xs text-muted-foreground">{fmtWhen(m.last_login_at)}</TD>
                  <TD className="text-xs text-muted-foreground">{fmtDate(m.created_at)}</TD>
                  <TD className="text-right">
                    {canManage && !isSelf ? (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" title={suspended ? "Reactivate" : "Suspend"}
                          onClick={() => run(() => setMemberStatus(m.user_id, suspended ? "active" : "suspended"), suspended ? "Reactivated" : "Suspended")}
                          aria-label={suspended ? `Reactivate ${m.name}` : `Suspend ${m.name}`}>
                          {suspended ? <Play className="h-4 w-4 text-green-600" /> : <Pause className="h-4 w-4 text-amber-600" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmId(m.user_id)} aria-label={`Remove ${m.name}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>

      {/* Pending invitations */}
      {canManage && pendingInvites.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Pending invitations ({pendingInvites.length})</h3>
          <Table>
            <THead><TR><TH>Email</TH><TH>Role</TH><TH>Expires</TH><TH className="text-right">Actions</TH></TR></THead>
            <TBody>
              {pendingInvites.map((i) => (
                <TR key={i.id}>
                  <TD className="font-medium">{i.email}</TD>
                  <TD>{ROLE_LABELS[i.role as keyof typeof ROLE_LABELS] ?? i.role}</TD>
                  <TD className="text-xs text-muted-foreground">{fmtDate(i.expires_at)}</TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => run(() => resendInvitation(i.id), "Invitation refreshed")}>Resend</Button>
                      <Button size="sm" variant="ghost" onClick={() => run(() => cancelInvitation(i.id), "Invitation cancelled")} aria-label={`Cancel invite for ${i.email}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmId}
        title="Remove team member?"
        description={confirmRow ? `${confirmRow.name || "This member"} will lose access to this organization. You can re-invite them later.` : ""}
        confirmLabel="Remove"
        destructive
        busy={pending}
        onConfirm={() => confirmId && start(async () => {
          const res = await removeMember(confirmId);
          if (res?.error) toast(res.error, "error");
          else { toast("Member removed"); setConfirmId(null); router.refresh(); }
        })}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}
