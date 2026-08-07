import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { JsonLd, organizationSchema, websiteSchema, breadcrumbSchema } from "@/components/seo/json-ld";

export const metadata: Metadata = pageMetadata({
  title: "Create your account",
  description:
    "Create a Romancham account and start running your restaurant or café on real numbers — inventory, recipe costing, wastage, sales and finance in one place.",
  path: "/signup",
  index: true,
});

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        schema={[
          organizationSchema,
          websiteSchema,
          breadcrumbSchema([{ name: "Create account", path: "/signup" }]),
        ]}
      />
      {children}
    </>
  );
}
