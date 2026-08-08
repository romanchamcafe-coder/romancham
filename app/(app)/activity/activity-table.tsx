"use client";
import { useMemo, useState } from "react";
import type { ActivityRow } from "@/server/queries/audit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Download, Search } from "lucide-react";

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function parseUA(ua: string | null): string {
  if (!ua) return "—";
  const browser = /Edg/i.test(ua) ? "Edge" : /OPR|Opera/i.test(ua) ? "Opera" : /Chrome/i.test(ua) ? "Chrome"
    : /Firefox/i.test(ua) ? "Firefox" : /Safari/i.test(ua) ? "Safari" : "Browser";
  const os = /Windows/i.test(ua) ? "Windows" : /Android/i.test(ua) ? "Android" : /iPhone|iPad|iOS/i.test(ua) ? "iOS"
    : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "";
  const device = /Mobile|Android|iPhone/i.test(ua) ? "Mobile" : "Desktop";
  return `${browser}${os ? " · " + os : ""} · ${device}`;
}

const actionTone = (a: string): "green" | "amber" | "red" | "muted" =>
  /insert|create|invite|login|reactivate/i.test(a) ? "green"
  : /delete|remove|suspend|cancel/i.test(a) ? "red"
  : /update|role|change/i.test(a) ? "amber" : "muted";

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function ActivityTable({ rows }: { rows: ActivityRow[] }) {
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");

  const entities = useMemo(() => Array.from(new Set(rows.map((r) => r.entity))).sort(), [rows]);
  const actions = useMemo(() => Array.from(new Set(rows.map((r) => r.action))).sort(), [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (entity && r.entity !== entity) return false;
      if (action && r.action !== action) return false;
      if (!needle) return true;
      return [r.user_name, r.entity, r.action, r.ip ?? "", r.branch_name ?? ""].join(" ").toLowerCase().includes(needle);
    });
  }, [rows, q, entity, action]);

  const exportCsv = () => {
    const head = ["Time", "User", "Action", "Table", "Record", "Branch", "IP", "Device", "Old", "New"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = filtered.map((r) => [
      fmt(r.created_at), r.user_name, r.action, r.entity, r.entity_id ?? "", r.branch_name ?? "",
      r.ip ?? "", parseUA(r.user_agent),
      r.old_value ? JSON.stringify(r.old_value) : "", r.new_value ? JSON.stringify(r.new_value) : "",
    ].map(esc).join(","));
    const csv = [head.map(esc).join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search user, table, IP…" className="pl-8" aria-label="Search activity" />
        </div>
        <select className={sel} value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="Filter by table">
          <option value="">All tables</option>
          {entities.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className={sel} value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action">
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} of {rows.length} events</p>

      <Table>
        <THead><TR>
          <TH>Time</TH><TH>User</TH><TH>Action</TH><TH>Table</TH><TH>Branch</TH><TH>IP</TH><TH>Device</TH><TH>Details</TH>
        </TR></THead>
        <TBody>
          {filtered.length === 0 ? (
            <TR><TD className="py-6 text-center text-muted-foreground">No activity matches your filters.</TD></TR>
          ) : filtered.map((r) => (
            <TR key={r.id}>
              <TD className="whitespace-nowrap text-xs text-muted-foreground">{fmt(r.created_at)}</TD>
              <TD className="font-medium">{r.user_name}</TD>
              <TD><Badge tone={actionTone(r.action)}>{r.action}</Badge></TD>
              <TD className="text-xs">{r.entity}</TD>
              <TD className="text-xs text-muted-foreground">{r.branch_name ?? "—"}</TD>
              <TD className="text-xs text-muted-foreground">{r.ip ?? "—"}</TD>
              <TD className="whitespace-nowrap text-xs text-muted-foreground">{parseUA(r.user_agent)}</TD>
              <TD>
                {(r.old_value || r.new_value) ? (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-primary">View</summary>
                    <div className="mt-1 space-y-1">
                      {r.old_value ? <pre className="max-w-[320px] overflow-auto rounded bg-red-50 p-1 text-[11px] text-red-800">{JSON.stringify(r.old_value, null, 1)}</pre> : null}
                      {r.new_value ? <pre className="max-w-[320px] overflow-auto rounded bg-green-50 p-1 text-[11px] text-green-800">{JSON.stringify(r.new_value, null, 1)}</pre> : null}
                    </div>
                  </details>
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
