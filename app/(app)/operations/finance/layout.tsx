import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/auth/session";
import { isPathBlocked } from "@/lib/auth/access";

export default async function FinanceGuard({ children }: { children: React.ReactNode }) {
  const ctx = await getActiveContext();
  if (isPathBlocked(ctx?.role, "/operations/finance")) redirect("/operations");
  return <>{children}</>;
}
