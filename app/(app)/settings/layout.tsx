import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/auth/session";
import { isPathBlocked } from "@/lib/auth/access";

// Team / org settings are owner/admin territory. Kitchen is blocked so it can't
// change roles (including its own) and lift the sales/P&L restriction.
export default async function SettingsGuard({ children }: { children: React.ReactNode }) {
  const ctx = await getActiveContext();
  if (isPathBlocked(ctx?.role, "/settings")) redirect("/dashboard");
  return <>{children}</>;
}
