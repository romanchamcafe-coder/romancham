"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { isValidGSTIN, isValidStateCode, isValidEmail, isValidPhone, stateCodeFromGSTIN } from "@/lib/validators/gst";
import type { ActionState } from "@/lib/types";

export async function addBranch(_: ActionState | null, formData: FormData): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Branch name required" };
  const state = String(formData.get("state_code") || "").trim();
  if (state && !isValidStateCode(state)) return { error: "State code must be a valid GST state code (01–38)" };
  const supabase = await createClient();
  const { error } = await supabase.from("branches").insert({
    org_id: ctx.orgId, name, state_code: state || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/settings/team");
  return { ok: true };
}

export type OrgInput = { name: string; gstin: string; state_code: string; address: string; phone: string; email: string };

export async function updateOrganization(input: OrgInput): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  if (ctx.role && ctx.role !== "owner") return { error: "Only the owner can edit organization details" };

  const name = (input.name || "").trim();
  const gstin = (input.gstin || "").trim();
  const state = (input.state_code || "").trim();
  const address = (input.address || "").trim();
  const phone = (input.phone || "").trim();
  const email = (input.email || "").trim();

  if (!name) return { error: "Organization name is required" };
  const gstinUpper = gstin.toUpperCase();
  if (gstin && !isValidGSTIN(gstinUpper)) return { error: "Enter a valid 15-character GSTIN (check the format and checksum)" };
  if (state && !isValidStateCode(state)) return { error: "State code must be a valid GST state code (01–38)" };
  if (gstin && state && stateCodeFromGSTIN(gstinUpper) !== state)
    return { error: `GSTIN starts with state code ${stateCodeFromGSTIN(gstinUpper)}, which doesn't match the state code ${state}` };
  if (email && !isValidEmail(email)) return { error: "Enter a valid email" };
  if (phone && !isValidPhone(phone)) return { error: "Enter a valid 10-digit phone number" };

  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({
    name, gstin: gstin || null, state_code: state || null,
    address: address || null, phone: phone || null, email: email || null,
  }).eq("id", ctx.orgId);
  if (error) return { error: error.message };
  revalidatePath("/settings/team");
  return { ok: true };
}

export async function updateBranch(id: string, name: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const n = (name || "").trim();
  if (!n) return { error: "Branch name is required" };
  const supabase = await createClient();
  const { error } = await supabase.from("branches").update({ name: n }).eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { error: error.message };
  revalidatePath("/settings/team");
  return { ok: true };
}

export async function deactivateBranch(id: string): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const supabase = await createClient();
  const { data: active } = await supabase.from("branches").select("id").eq("org_id", ctx.orgId).eq("is_active", true);
  if ((active ?? []).length <= 1) return { error: "You need at least one active branch" };
  const { error } = await supabase.from("branches").update({ is_active: false }).eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { error: error.message };
  revalidatePath("/settings/team");
  return { ok: true };
}
