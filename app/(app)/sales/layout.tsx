import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/auth/session";
import { isPathBlocked } from "@/lib/auth/access";

// Kitchen (and other restricted roles) may not see Sales.
export default async function SalesGuard({ children }: { children: React.ReactNode }) {
  const ctx = await getActiveContext();
  if (isPathBlocked(ctx?.role, "/sales")) redirect("/dashboard");
  return <>{children}</>;
}
