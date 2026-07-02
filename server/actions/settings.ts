"use server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/types";

export async function addBranch(_: ActionState | null, formData: FormData): Promise<ActionState> {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return { error: "No active organization" };
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Branch name required" };
  const supabase = await createClient();
  const { error } = await supabase.from("branches").insert({
    org_id: ctx.orgId, name, state_code: String(formData.get("state_code") || "").trim() || null,
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
  if (gstin && gstin.length !== 15) return { error: "GSTIN must be 15 characters" };
  if (state && !/^\d{2}$/.test(state)) return { error: "State code must be 2 digits" };
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email" };
  if (phone && !/^[0-9+\-\s()]{6,20}$/.test(phone)) return { error: "Enter a valid phone number" };

  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({
    name, gstin: gstin || null, state_code: state || null,
    address: address || null, phone: phone || null, email: email || null,
  }).eq("id", ctx.orgId);
  if (error) return { error: error.message };
  revalidatePath("/settings/team");
  return { ok: true };
}
