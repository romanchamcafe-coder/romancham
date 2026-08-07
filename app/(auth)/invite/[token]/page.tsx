import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/seo";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { AcceptInvite } from "./accept-invite";

export const metadata: Metadata = pageMetadata({
  title: "Team invitation",
  description: "Accept your invitation to join a Romancham workspace.",
  path: "/invite",
});

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const [{ data: inv }, { data: { user } }] = await Promise.all([
    supabase.rpc("get_invitation", { p_token: token }),
    supabase.auth.getUser(),
  ]);
  const invite = Array.isArray(inv) ? inv[0] : null;

  if (!invite) {
    return (
      <Card><CardContent className="space-y-2 pt-6 text-center">
        <h1 className="text-lg font-semibold">Invitation not found</h1>
        <p className="text-sm text-muted-foreground">This invite link isn&apos;t valid. Ask your admin to send a new one.</p>
        <Link href="/login" className="text-sm text-primary underline">Go to sign in</Link>
      </CardContent></Card>
    );
  }

  const expired = invite.status !== "pending" || (invite.expires_at && new Date(invite.expires_at) < new Date());
  const roleLabel = ROLE_LABELS[invite.role as keyof typeof ROLE_LABELS] ?? invite.role;
  const emailMatches = user?.email && user.email.toLowerCase() === String(invite.email).toLowerCase();

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="text-center">
          <h1 className="text-lg font-semibold">Join {invite.org_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You&apos;ve been invited to join <b>{invite.org_name}</b> as <b>{roleLabel}</b>.
          </p>
        </div>

        {expired ? (
          <p className="rounded-md bg-amber-50 p-3 text-center text-sm text-amber-800">
            This invitation has expired or was already used. Please ask for a fresh invite.
          </p>
        ) : !user ? (
          <div className="space-y-2 text-center text-sm">
            <p className="text-muted-foreground">Sign in (or create an account) with <b>{invite.email}</b> to accept.</p>
            <div className="flex justify-center gap-3">
              <Link href={`/login?next=/invite/${token}`} className="text-primary underline">Sign in</Link>
              <Link href="/signup" className="text-primary underline">Create account</Link>
            </div>
          </div>
        ) : !emailMatches ? (
          <p className="rounded-md bg-amber-50 p-3 text-center text-sm text-amber-800">
            You&apos;re signed in as {user.email}, but this invite was sent to {invite.email}. Sign in with the invited email to accept.
          </p>
        ) : (
          <AcceptInvite token={token} orgName={invite.org_name} />
        )}
      </CardContent>
    </Card>
  );
}
