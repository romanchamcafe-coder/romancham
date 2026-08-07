import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Set up your business",
  description: "Finish setting up your Romancham workspace to start tracking operations.",
  path: "/welcome",
});

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
