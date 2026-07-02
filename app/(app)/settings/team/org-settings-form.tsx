"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrganization, type OrgInput } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";

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
  const set = (k: keyof OrgInput) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  const save = () => {
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
          <Input id="org-gstin" value={v.gstin} onChange={set("gstin")} maxLength={15} placeholder="15-character GSTIN" aria-describedby="org-gstin-hint" />
          <p id="org-gstin-hint" className="text-xs text-muted-foreground">Optional. 15 characters if provided.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-state">State code</Label>
          <Input id="org-state" value={v.state_code} onChange={set("state_code")} maxLength={2} placeholder="e.g. 33" aria-describedby="org-state-hint" />
          <p id="org-state-hint" className="text-xs text-muted-foreground">2-digit GST state code. Drives CGST/SGST vs IGST.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-phone">Phone</Label>
          <Input id="org-phone" value={v.phone} onChange={set("phone")} type="tel" placeholder="Business phone" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-email">Email</Label>
          <Input id="org-email" value={v.email} onChange={set("email")} type="email" placeholder="Business email" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-address">Address</Label>
          <Input id="org-address" value={v.address} onChange={set("address")} placeholder="Business address" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
        <span className="text-xs text-muted-foreground">Plan: {org.plan ?? "free"}</span>
      </div>
    </div>
  );
}
