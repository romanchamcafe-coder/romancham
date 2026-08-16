import {
  LayoutDashboard, ClipboardCheck, Boxes, Store, Tags, Ruler, ChefHat, ShoppingCart, IndianRupee, Package, Receipt, Settings, ScrollText, BarChart3, Plug, Sparkles, Calculator, Warehouse,
} from "lucide-react";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ai", label: "AI Analyst", icon: Sparkles },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/operations", label: "Operations", icon: ClipboardCheck },
  { href: "/sales", label: "Sales", icon: IndianRupee },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/production-consumption", label: "Production & Consumption", icon: Warehouse },
  { href: "/menu-engineering", label: "Menu Engineering", icon: Calculator },
  { href: "/recipes", label: "Recipes", icon: ChefHat },
  { href: "/purchases", label: "Purchases", icon: ShoppingCart },
  { href: "/masters/vendors", label: "Vendors", icon: Store },
  { href: "/masters/ingredients", label: "Ingredients", icon: Boxes },
  { href: "/masters/categories", label: "Categories", icon: Tags },
  { href: "/masters/units", label: "Units (UOM)", icon: Ruler },
  { href: "/pos", label: "POS Connectors", icon: Plug },
  { href: "/activity", label: "Activity Log", icon: ScrollText },
  { href: "/settings/team", label: "Settings", icon: Settings },
];
