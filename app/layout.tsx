import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Romancham",
  description: "Romancham — inventory, recipes, sales & analytics for your café.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
