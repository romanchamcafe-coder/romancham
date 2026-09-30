import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { getActiveContext } from "@/lib/auth/session";
import { canSeePay } from "@/lib/attendance";
import { getStaff, getDayAttendance, getMonthData, getPay } from "@/server/queries/attendance";
import { DailyAttendance } from "./daily-attendance";
import { MonthlySummary } from "./monthly-summary";
import { StaffManager } from "./staff-manager";
import { AdvancesPanel } from "./advances-panel";
import { cn } from "@/lib/utils";

export const metadata: Metadata = pageMetadata({ title: "Attendance", description: "Daily staff attendance, overtime, advances and monthly salary summary.", path: "/attendance" });

const todayIST = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ tab?: string; date?: string; month?: string }> }) {
  const ctx = await getActiveContext();
  const sp = await searchParams;
  const orgId = ctx!.orgId!, branchId = ctx!.branch?.id ?? null;
  const pay = canSeePay(ctx?.role);
  const today = todayIST();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : today.slice(0, 7);
  const tabs = [
    ["daily", "Daily attendance"], ["summary", pay ? "Monthly summary & salary" : "Monthly summary"], ["staff", "Staff"],
    ...(pay ? [["advances", "Advances"]] : []),
  ] as [string, string][];
  const tab = tabs.some(([k]) => k === sp.tab) ? sp.tab! : "daily";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Attendance <span className="text-sm font-normal text-muted-foreground">· {ctx!.branch?.name}</span></h1>
        <p className="text-sm text-muted-foreground">Mark staff attendance daily; the monthly summary {pay ? "works out salary, overtime and advances" : "shows days worked and overtime"} automatically.</p>
      </div>
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {tabs.map(([k, label]) => (
          <Link key={k} href={`/attendance?tab=${k}${k === "daily" ? `&date=${date}` : k === "staff" ? "" : `&month=${month}`}`}
            className={cn("rounded-md px-3 py-1.5 text-sm", tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            {label}
          </Link>
        ))}
      </div>

      {tab === "daily" && <DailyTab orgId={orgId} branchId={branchId} date={date} today={today} />}
      {tab === "summary" && <SummaryTab orgId={orgId} branchId={branchId} month={month} role={ctx?.role ?? null} today={today} />}
      {tab === "staff" && <StaffTab orgId={orgId} branchId={branchId} role={ctx?.role ?? null} />}
      {tab === "advances" && pay && <AdvTab orgId={orgId} branchId={branchId} month={month} role={ctx?.role ?? null} today={today} />}
    </div>
  );
}

async function DailyTab({ orgId, branchId, date, today }: { orgId: string; branchId: string | null; date: string; today: string }) {
  const [staff, rows] = await Promise.all([getStaff(orgId, branchId), getDayAttendance(orgId, branchId, date)]);
  return <DailyAttendance key={date} date={date} today={today} staff={staff} rows={rows} />;
}
async function SummaryTab({ orgId, branchId, month, role, today }: { orgId: string; branchId: string | null; month: string; role: string | null; today: string }) {
  const d = await getMonthData(orgId, branchId, month, role);
  return <MonthlySummary month={month} today={today} showPay={canSeePay(role)} {...d} />;
}
async function StaffTab({ orgId, branchId, role }: { orgId: string; branchId: string | null; role: string | null }) {
  const [staff, pay] = await Promise.all([getStaff(orgId, branchId, true), getPay(orgId, role)]);
  return <StaffManager staff={staff} pay={pay} showPay={canSeePay(role)} />;
}
async function AdvTab({ orgId, branchId, month, role, today }: { orgId: string; branchId: string | null; month: string; role: string | null; today: string }) {
  const d = await getMonthData(orgId, branchId, month, role);
  return <AdvancesPanel month={month} today={today} staff={d.staff.filter((s) => s.is_active)} advances={d.advances} allStaff={d.staff} />;
}
