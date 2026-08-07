import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import {
  JsonLd,
  organizationSchema,
  websiteSchema,
  softwareApplicationSchema,
  webApplicationSchema,
  breadcrumbSchema,
} from "@/components/seo/json-ld";

export const metadata: Metadata = pageMetadata({
  title: "Sign in",
  description:
    "Sign in to Romancham — the restaurant & café operations platform for checklists, inventory, recipe costing, wastage, sales and finance.",
  path: "/login",
  index: true,
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        schema={[
          organizationSchema,
          websiteSchema,
          softwareApplicationSchema,
          webApplicationSchema,
          breadcrumbSchema([{ name: "Sign in", path: "/login" }]),
        ]}
      />
      {children}
    </>
  );
}
