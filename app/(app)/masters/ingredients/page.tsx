import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { IngredientsView } from "./ingredients-view";

export const metadata: Metadata = pageMetadata({ title: "Ingredients", description: "Maintain your ingredient master with units, costs, reorder levels and fulfilment type.", path: "/masters/ingredients" });

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  return <IngredientsView type={type} hrefFor={(k) => (k === "all" ? "/masters/ingredients" : `/masters/ingredients?type=${k}`)} />;
}
