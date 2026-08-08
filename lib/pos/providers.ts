// Client-safe POS provider registry (no server imports).

export type PosMode = "csv" | "api";
export type PosProviderKey =
  | "petpooja" | "dotpe" | "posist" | "urbanpiper" | "toast" | "square" | "generic";

export type PosProvider = {
  key: PosProviderKey;
  name: string;
  modes: PosMode[];
  /** "available" = usable today (CSV), "planned" = API connector on the roadmap. */
  availability: "available" | "planned";
  note?: string;
};

export const POS_PROVIDERS: PosProvider[] = [
  { key: "petpooja", name: "Petpooja", modes: ["csv", "api"], availability: "available", note: "CSV import is live. Direct API sync is planned." },
  { key: "dotpe", name: "DotPe", modes: ["api"], availability: "planned" },
  { key: "posist", name: "POSist", modes: ["api"], availability: "planned" },
  { key: "urbanpiper", name: "UrbanPiper", modes: ["api"], availability: "planned" },
  { key: "toast", name: "Toast", modes: ["api"], availability: "planned" },
  { key: "square", name: "Square", modes: ["api"], availability: "planned" },
  { key: "generic", name: "Generic REST API", modes: ["api"], availability: "planned", note: "Bring-your-own endpoint that returns sales rows." },
];

export const providerName = (key: string) =>
  POS_PROVIDERS.find((p) => p.key === key)?.name ?? key;
