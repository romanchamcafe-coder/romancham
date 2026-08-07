import type { Metadata } from "next";

/** Canonical production origin. Override per-environment with NEXT_PUBLIC_SITE_URL. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://romancham-nine.vercel.app"
).replace(/\/$/, "");

export const SITE_NAME = "Romancham";
export const SITE_TAGLINE = "Restaurant Operations Management System";
export const SITE_DESCRIPTION =
  "Romancham is a restaurant & café operations platform — daily checklists, inventory & indents, recipe costing, wastage, sales, and finance, all on real numbers.";

export const SITE_KEYWORDS = [
  "restaurant operations",
  "cafe management software",
  "restaurant inventory management",
  "kitchen recipe costing",
  "food cost tracking",
  "wastage tracking",
  "cash reconciliation",
  "restaurant P&L",
  "restaurant checklists",
  "Romancham",
];

export const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
};

type PageMetaInput = {
  title: string;
  description?: string;
  /** Absolute path from the site root, e.g. "/operations". Used for the canonical URL. */
  path: string;
  /** Public pages should be indexable; app/auth pages default to noindex. */
  index?: boolean;
};

/**
 * Build a consistent per-page Metadata object: unique title, description,
 * canonical URL and robots directives. Private pages are noindex by default.
 */
export function pageMetadata({ title, description, path, index = false }: PageMetaInput): Metadata {
  return {
    title,
    description: description ?? SITE_DESCRIPTION,
    alternates: { canonical: path },
    robots: index
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
    openGraph: {
      title: `${title} · ${SITE_NAME}`,
      description: description ?? SITE_DESCRIPTION,
      url: path,
      type: "website",
    },
  };
}
