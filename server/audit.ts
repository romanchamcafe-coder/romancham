import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";

type LogInput = {
  action: string; // e.g. "login", "invite", "role_change", "remove", "suspend"
  entity: string; // affected table / domain, e.g. "auth", "memberships", "invitations"
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  branchId?: string | null;
  orgId?: string | null; // override when ctx isn't available (e.g. right after login)
};

/**
 * Record an activity-log entry with client context (IP + user agent).
 * Best-effort: never throws into the caller. Business-table changes are captured
 * automatically by DB triggers; this covers auth/team events.
 */
export async function logActivity(input: LogInput): Promise<void> {
  try {
    const supabase = await createClient();
    let orgId = input.orgId ?? null;
    let branchId = input.branchId ?? null;
    if (!orgId) {
      const ctx = await getActiveContext();
      orgId = ctx?.orgId ?? null;
      branchId = branchId ?? ctx?.branch?.id ?? null;
    }
    if (!orgId) return;

    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
    const ua = h.get("user-agent") ?? null;

    await supabase.rpc("log_audit", {
      p_org: orgId,
      p_branch: branchId,
      p_action: input.action,
      p_entity: input.entity,
      p_entity_id: input.entityId ?? null,
      p_old: (input.oldValue ?? null) as never,
      p_new: (input.newValue ?? null) as never,
      p_ip: ip,
      p_ua: ua,
    });
  } catch {
    // auditing must never break the primary action
  }
}
