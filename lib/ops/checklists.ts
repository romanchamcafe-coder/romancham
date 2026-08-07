// Checklist definitions live in code so staff get ready-to-use checklists
// with zero setup. Completed runs are stored as JSONB in ops_checklist_runs.

export type ChecklistItem = {
  key: string;
  label: string;
  critical?: boolean;          // food-safety critical control point (weighs the score)
  value?: "temp" | "text";     // optional captured value (e.g. a fridge temperature)
};

export type ChecklistDef = {
  type: string;
  title: string;
  short: string;
  slot?: "morning" | "afternoon" | "night";
  items: ChecklistItem[];
};

export const CHECKLISTS: ChecklistDef[] = [
  {
    type: "opening",
    title: "Opening Checklist",
    short: "Opening",
    items: [
      { key: "lights_power", label: "Lights & power on" },
      { key: "equipment_on", label: "Equipment switched on & warming up" },
      { key: "fridge_temp", label: "Fridge / freezer temperature checked", value: "temp", critical: true },
      { key: "stock_ready", label: "Prep stock available for service" },
      { key: "clean_stations", label: "Stations clean & sanitised" },
      { key: "handwash", label: "Handwash stations stocked (soap, towels)" },
      { key: "float_cash", label: "Cash float counted & set" },
      { key: "staff_present", label: "Staff present & in uniform" },
    ],
  },
  {
    type: "closing",
    title: "Closing Checklist",
    short: "Closing",
    items: [
      { key: "surfaces_clean", label: "All surfaces cleaned & sanitised" },
      { key: "food_stored", label: "Food covered, labelled & stored" },
      { key: "fridge_temp", label: "Fridge / freezer temperature checked", value: "temp", critical: true },
      { key: "waste_out", label: "Waste & bins emptied" },
      { key: "equipment_off", label: "Equipment switched off / cleaned" },
      { key: "gas_off", label: "Gas & burners turned off", critical: true },
      { key: "cash_reconciled", label: "Cash counted & reconciled" },
      { key: "doors_locked", label: "Doors & windows locked" },
    ],
  },
  {
    type: "cleaning_morning",
    title: "Cleaning — Morning",
    short: "Cleaning AM",
    slot: "morning",
    items: [
      { key: "floors", label: "Floors swept & mopped" },
      { key: "prep_tables", label: "Prep tables sanitised" },
      { key: "sinks", label: "Sinks cleaned" },
      { key: "handwash", label: "Handwash area stocked" },
      { key: "bins", label: "Bins lined & clean" },
    ],
  },
  {
    type: "cleaning_afternoon",
    title: "Cleaning — Afternoon",
    short: "Cleaning PM",
    slot: "afternoon",
    items: [
      { key: "surfaces", label: "Work surfaces wiped down" },
      { key: "floors_spot", label: "Floors spot-cleaned" },
      { key: "utensils", label: "Utensils washed & put away" },
      { key: "bins", label: "Bins emptied if full" },
    ],
  },
  {
    type: "cleaning_night",
    title: "Cleaning — Night",
    short: "Cleaning Night",
    slot: "night",
    items: [
      { key: "deep_surfaces", label: "Deep clean all surfaces" },
      { key: "equipment", label: "Equipment cleaned inside & out" },
      { key: "floors_deep", label: "Floors deep-mopped" },
      { key: "drains", label: "Drains cleared & sanitised" },
      { key: "bins_out", label: "All bins emptied & sanitised" },
      { key: "fridge_wipe", label: "Fridge handles & seals wiped" },
    ],
  },
  {
    type: "food_safety",
    title: "Food Safety Checklist",
    short: "Food Safety",
    items: [
      { key: "chiller_temp", label: "Chiller temperature ≤ 5°C", value: "temp", critical: true },
      { key: "freezer_temp", label: "Freezer temperature ≤ -18°C", value: "temp", critical: true },
      { key: "hot_hold", label: "Hot-hold food ≥ 63°C", value: "temp", critical: true },
      { key: "labels", label: "All prepped food labelled & dated", critical: true },
      { key: "no_expired", label: "No expired stock in use", critical: true },
      { key: "raw_cooked", label: "Raw & cooked stored separately", critical: true },
      { key: "handwash", label: "Handwashing observed" },
      { key: "cloths", label: "Clean cloths & sanitiser in use" },
      { key: "pest", label: "No signs of pests" },
    ],
  },
];

export const CHECKLIST_MAP: Record<string, ChecklistDef> = Object.fromEntries(
  CHECKLISTS.map((c) => [c.type, c]),
);

export const WASTAGE_REASONS: [string, string][] = [
  ["spoilage", "Spoilage"],
  ["overproduction", "Over-production"],
  ["spillage", "Spillage / breakage"],
  ["expiry", "Expired"],
  ["prep_error", "Prep / cooking error"],
  ["returned", "Customer return"],
  ["other", "Other"],
];

export const WASTAGE_REASON_LABEL: Record<string, string> = Object.fromEntries(WASTAGE_REASONS);
