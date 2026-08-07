import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * Only genuinely public, anonymously-reachable pages belong in the sitemap.
 * Authenticated dashboards, API routes and Supabase auth callbacks are excluded.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
  ];
}
