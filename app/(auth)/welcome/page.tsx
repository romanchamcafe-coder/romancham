import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/auth/session";
import { WelcomeForm } from "./welcome-form";

export default async function WelcomePage() {
  const ctx = await getActiveContext();
  if (!ctx) redirect("/login");
  if (ctx.org) redirect("/dashboard");
  return <WelcomeForm />;
}
