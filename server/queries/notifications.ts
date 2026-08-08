import { createClient } from "@/lib/supabase/server";

export type Notification = {
  id: string;
  type: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

const RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export async function getNotifications(orgId: string): Promise<{ items: Notification[]; unread: number }> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("notifications")
      .select("id, type, priority, title, body, href, read_at, created_at")
      .eq("org_id", orgId)
      .not("title", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    const items = (data ?? []).slice().sort((a: any, b: any) => {
      const ar = a.read_at ? 1 : 0, br = b.read_at ? 1 : 0;
      if (ar !== br) return ar - br; // unread first
      const pr = (RANK[a.priority] ?? 9) - (RANK[b.priority] ?? 9);
      if (pr !== 0) return pr;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }) as Notification[];

    const unread = items.filter((n) => !n.read_at).length;
    return { items, unread };
  } catch (e) {
    console.error("getNotifications failed", e);
    return { items: [], unread: 0 };
  }
}
