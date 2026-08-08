// Client-safe task metadata.

export const TASK_TYPES = [
  { key: "opening", label: "Opening" },
  { key: "closing", label: "Closing" },
  { key: "cleaning", label: "Cleaning" },
  { key: "food_safety", label: "Food Safety" },
  { key: "maintenance", label: "Maintenance" },
  { key: "production", label: "Production" },
  { key: "inventory_count", label: "Inventory Count" },
  { key: "vendor_followup", label: "Vendor Follow-up" },
  { key: "other", label: "Other" },
] as const;

export type TaskType = (typeof TASK_TYPES)[number]["key"];
export const TASK_TYPE_LABEL: Record<string, string> = Object.fromEntries(TASK_TYPES.map((t) => [t.key, t.label]));

export const TASK_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
