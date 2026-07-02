"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { vendorSchema, type VendorInput } from "@/lib/validators/vendor";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

async function isDuplicateName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string, name: string, excludeId: string | null,
) {
  const { data } = await supabase
    .from("vendors").select("id, name").eq("org_id", orgId).eq("is_active", true);
  const target = name.trim().toLowerCase();
  return (data ?? []).some((r: any) => r.id !== excludeId && String(r.name).trim().toLowerCase() === target);
}

export async function createVendor(input: VendorInput): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  if (await isDuplicateName(supabase, ctx.orgId, parsed.data.name, null))
    return { error: `Vendor "${parsed.data.name}" already exists` };
  const { error } = await supabase.from("vendors").insert({ ...parsed.data, org_id: ctx.orgId });
  if (error) return { error: error.message };
  revalidatePath("/masters/vendors");
  return { ok: true };
}

export async function updateVendor(id: string, input: VendorInput): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  if (await isDuplicateName(supabase, ctx.orgId, parsed.data.name, id))
    return { error: `Vendor "${parsed.data.name}" already exists` };
  const { error } = await supabase.from("vendors").update(parsed.data).eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { error: error.message };
  revalidatePath("/masters/vendors");
  return { ok: true };
}

export async function archiveVendor(id: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const supabase = await createClient();
  const { error } = await supabase.from("vendors").update({ is_active: false }).eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { error: error.message };
  revalidatePath("/masters/vendors");
  return { ok: true };
}
