import type { Metadata } from "next";
import Link from "next/link";
import { getActiveContext } from "@/lib/auth/session";
import { getPosOverview } from "@/server/queries/pos";
import { POS_PROVIDERS } from "@/lib/pos/providers";
import { pageMetadata } from "@/lib/seo";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ConnectorActions } from "./connector-actions";

export const metadata: Metadata = pageMetadata({
  title: "POS Connectors",
  description: "Connect your POS — Petpooja CSV today, DotPe, POSist, UrbanPiper, Toast, Square and a generic API next.",
  path: "/pos",
});

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never";

export default async function PosPage() {
  const ctx = await getActiveContext();
  if (!ctx?.orgId) return null;
  const canManage = ctx.role === "owner" || ctx.role === "admin";
  const { items, history } = await getPosOverview(ctx.orgId);
  const meta = new Map(POS_PROVIDERS.map((p) => [p.key, p]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">POS Connectors</h1>
        <p className="text-sm text-muted-foreground">
          Bring sales into Romancham. Petpooja works today via CSV; other POS systems connect over API soon.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => {
          const m = meta.get(c.key)!;
          return (
            <Card key={c.key}>
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.modes.map((mode) => <Badge key={mode} tone="muted" className="uppercase">{mode}</Badge>)}
                      {m.availability === "available"
                        ? <Badge tone="green">Available</Badge>
                        : <Badge tone="amber">Planned</Badge>}
                    </div>
                  </div>
                  <Badge tone={c.status === "connected" ? "green" : c.status === "error" ? "red" : "muted"}>
                    {c.status === "connected" ? "Connected" : c.status === "error" ? "Error" : "Not connected"}
                  </Badge>
                </div>

                {m.note && <p className="text-xs text-muted-foreground">{m.note}</p>}

                <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/40 p-2 text-center text-xs">
                  <div><p className="text-muted-foreground">Last sync</p><p className="mt-0.5 font-medium">{c.lastSyncAt ? fmt(c.lastSyncAt).split(",")[0] : "—"}</p></div>
                  <div><p className="text-muted-foreground">Imported</p><p className="mt-0.5 font-medium text-green-600">{c.imported.toLocaleString("en-IN")}</p></div>
                  <div><p className="text-muted-foreground">Failed</p><p className={`mt-0.5 font-medium ${c.failed ? "text-red-600" : ""}`}>{c.failed.toLocaleString("en-IN")}</p></div>
                </div>

                {c.key === "petpooja" && (
                  <Link href="/sales" className="block text-center text-sm font-medium text-primary hover:underline">
                    Import Petpooja CSV on Sales →
                  </Link>
                )}

                {canManage && <ConnectorActions providerKey={c.key} status={c.status} available={m.availability === "available"} />}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Sync history</h2>
        {history.length === 0 ? (
          <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">No syncs yet. Import a Petpooja CSV from the Sales page to get started.</p>
        ) : (
          <Table>
            <THead><TR><TH>When</TH><TH>Provider</TH><TH>Source</TH><TH>File</TH><TH>Rows</TH><TH>Imported</TH><TH>Failed</TH><TH>Status</TH></TR></THead>
            <TBody>
              {history.map((h) => (
                <TR key={h.id}>
                  <TD className="whitespace-nowrap text-xs text-muted-foreground">{fmt(h.created_at)}</TD>
                  <TD className="capitalize">{h.provider}</TD>
                  <TD className="text-xs uppercase text-muted-foreground">{h.source}</TD>
                  <TD className="max-w-[180px] truncate text-xs">{h.file ?? "—"}</TD>
                  <TD className="text-xs">{h.total}</TD>
                  <TD className="text-xs text-green-600">{h.ok}</TD>
                  <TD className={`text-xs ${h.error ? "text-red-600" : ""}`}>{h.error}</TD>
                  <TD><Badge tone={h.status === "done" ? "green" : "amber"} className="capitalize">{h.status}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}
