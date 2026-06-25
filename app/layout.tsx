import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brewmetrics",
  description: "Inventory, recipes, sales & analytics for cafés, bakeries & cloud kitchens.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
