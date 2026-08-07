import {
  LayoutDashboard, ClipboardCheck, Boxes, Store, Tags, Ruler, ChefHat, Factory, ShoppingCart, IndianRupee, Package, Receipt, Settings,
} from "lucide-react";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/operations", label: "Operations", icon: ClipboardCheck },
  { href: "/masters/ingredients", label: "Ingredients", icon: Boxes },
  { href: "/masters/vendors", label: "Vendors", icon: Store },
  { href: "/masters/categories", label: "Categories", icon: Tags },
  { href: "/masters/units", label: "Units (UOM)", icon: Ruler },
  { href: "/recipes", label: "Recipes", icon: ChefHat },
  { href: "/production", label: "Production", icon: Factory },
  { href: "/purchases", label: "Purchases", icon: ShoppingCart },
  { href: "/sales", label: "Sales", icon: IndianRupee },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/settings/team", label: "Settings", icon: Settings },
];
