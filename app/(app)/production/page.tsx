import { redirect } from "next/navigation";

// The standalone Production module has been superseded by the unified
// Production & Consumption module (immutable ledger, Store/Display, FIFO,
// wastage, physical count, reports). Old links redirect there.
export default function ProductionRedirect() {
  redirect("/production-consumption/production");
}
