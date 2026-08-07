import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * Romancham is a private operations tool. Crawlers may see the public marketing
 * surface (login / signup) but every authenticated route, API and auth callback
 * is disallowed so internal dashboards never enter a search index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/signup"],
        disallow: [
          "/dashboard",
          "/operations",
          "/sales",
          "/purchases",
          "/inventory",
          "/recipes",
          "/expenses",
          "/production",
          "/masters",
          "/settings",
          "/welcome",
          "/reset-password",
          "/forgot-password",
          "/api",
          "/auth",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
