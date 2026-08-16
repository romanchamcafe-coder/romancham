// Pure FIFO batch allocation — mirrors the SQL allocation used by the
// stock-ledger RPCs (post_stock_transfer / post_wastage_finished /
// sync_finished_sales). Kept side-effect free so the UI can preview an
// allocation and so it can be unit-tested without a database.

export type Batch = {
  id: string;
  code?: string;
  onHand: number;          // available at the source location
  unitCost: number;        // cost_per_stock_unit
  producedOn?: string;     // ISO date — batches are consumed oldest-first
};

export type Allocation = { batchId: string; code?: string; qty: number; unitCost: number; value: number };

export type FifoResult = {
  allocations: Allocation[];
  allocated: number;       // total qty drawn from real batches
  shortfall: number;       // qty that could not be covered (oversold)
  value: number;           // total cost value of the allocated qty
};

/** Allocate `need` units across `batches`, oldest first. Never mutates input. */
export function allocateFifo(batches: Batch[], need: number): FifoResult {
  const sorted = [...batches]
    .filter((b) => b.onHand > 0)
    .sort((a, b) => (a.producedOn ?? "").localeCompare(b.producedOn ?? ""));
  const allocations: Allocation[] = [];
  let remaining = Math.max(0, need);
  let value = 0;
  for (const b of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(b.onHand, remaining);
    if (take <= 0) continue;
    const v = take * b.unitCost;
    allocations.push({ batchId: b.id, code: b.code, qty: take, unitCost: b.unitCost, value: v });
    value += v;
    remaining -= take;
  }
  return {
    allocations,
    allocated: Math.max(0, need) - remaining,
    shortfall: remaining,
    value,
  };
}
