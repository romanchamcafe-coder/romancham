"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrganization, type OrgInput } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import { isValidGSTIN, isValidStateCode, isValidEmail, isValidPhone, stateCodeFromGSTIN } from "@/lib/validators/gst";

type Org = {
  name?: string | null; gstin?: string | null; state_code?: string | null;
  address?: string | null; phone?: string | null; email?: string | null; plan?: string | null;
};

export function OrgSettingsForm({ org }: { org: Org }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState<OrgInput>({
    name: org.name ?? "", gstin: org.gstin ?? "", state_code: org.state_code ?? "",
    address: org.address ?? "", phone: org.phone ?? "", email: org.email ?? "",
  });
  const set = (k: keyof OrgInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((s) => ({ ...s, [k]: k === "gstin" ? e.target.value.toUpperCase() : e.target.value }));

  const gstin = (v.gstin || "").trim();
  const state = (v.state_code || "").trim();
  const errs = {
    gstin: gstin && !isValidGSTIN(gstin) ? "Invalid GSTIN — check the 15-character format and checksum."
      : gstin && state && stateCodeFromGSTIN(gstin) !== state ? `GSTIN state (${stateCodeFromGSTIN(gstin)}) doesn't match the state code below.` : "",
    state_code: state && !isValidStateCode(state) ? "Use a valid GST state code (01–38)." : "",
    email: v.email && !isValidEmail(v.email) ? "Enter a valid email address." : "",
    phone: v.phone && !isValidPhone(v.phone) ? "Enter a valid 10-digit phone number." : "",
  };
  const hasErrors = Object.values(errs).some(Boolean);

  const save = () => {
    if (hasErrors) { toast("Please fix the highlighted fields", "error"); return; }
    start(async () => {
      const res = await updateOrganization(v);
      if (res.error) toast(res.error, "error");
      else { toast("Organization details saved"); router.refresh(); }
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="org-name">Organization name</Label>
          <Input id="org-name" value={v.name} onChange={set("name")} aria-required placeholder="e.g. Strictly Desserts" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-gstin">GSTIN</Label>
          <Input id="org-gstin" value={v.gstin} onChange={set("gstin")} maxLength={15} placeholder="15-character GSTIN"
            aria-invalid={!!errs.gstin} aria-describedby="org-gstin-hint" className={errs.gstin ? "border-destructive" : ""} />
          {errs.gstin ? <p id="org-gstin-hint" className="text-xs text-destructive">{errs.gstin}</p>
            : gstin && isValidGSTIN(gstin) ? <p id="org-gstin-hint" className="text-xs text-green-600">✓ Valid GSTIN · state {stateCodeFromGSTIN(gstin)}</p>
            : <p id="org-gstin-hint" className="text-xs text-muted-foreground">Optional. 15 characters if provided.</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-state">State code</Label>
          <Input id="org-state" value={v.state_code} onChange={set("state_code")} maxLength={2} placeholder="e.g. 33"
            aria-invalid={!!errs.state_code} aria-describedby="org-state-hint" className={errs.state_code ? "border-destructive" : ""} />
          {errs.state_code ? <p id="org-state-hint" className="text-xs text-destructive">{errs.state_code}</p>
            : <p id="org-state-hint" className="text-xs text-muted-foreground">2-digit GST state code. Drives CGST/SGST vs IGST.</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-phone">Phone</Label>
          <Input id="org-phone" value={v.phone} onChange={set("phone")} type="tel" placeholder="Business phone"
            aria-invalid={!!errs.phone} className={errs.phone ? "border-destructive" : ""} />
          {errs.phone && <p className="text-xs text-destructive">{errs.phone}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-email">Email</Label>
          <Input id="org-email" value={v.email} onChange={set("email")} type="email" placeholder="Business email"
            aria-invalid={!!errs.email} className={errs.email ? "border-destructive" : ""} />
          {errs.email && <p className="text-xs text-destructive">{errs.email}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-address">Address</Label>
          <Input id="org-address" value={v.address} onChange={set("address")} placeholder="Business address" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending || hasErrors}>{pending ? "Saving…" : "Save changes"}</Button>
        <span className="text-xs text-muted-foreground">Plan: {org.plan ?? "free"}</span>
      </div>
    </div>
  );
}
