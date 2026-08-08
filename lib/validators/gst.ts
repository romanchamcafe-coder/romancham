// ============================================================
// Romancham — Indian GST / tax field validators
// Pure functions, safe on client and server.
// ============================================================

const CODE = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Valid GST state (TIN) codes: 01–38 plus 97 (Other Territory). */
export function isValidStateCode(code: string): boolean {
  const c = (code || "").trim();
  if (!/^\d{2}$/.test(c)) return false;
  const n = Number(c);
  return (n >= 1 && n <= 38) || n === 97;
}

/** PAN — 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F). */
export function isValidPAN(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test((pan || "").trim().toUpperCase());
}

/** Compute the GSTIN checksum character (mod-36 algorithm) for the first 14 chars. */
export function gstinChecksumChar(first14: string): string {
  let factor = 2;
  let sum = 0;
  for (let i = 13; i >= 0; i--) {
    const cp = CODE.indexOf(first14[i]);
    if (cp < 0) return "";
    let digit = factor * cp;
    factor = factor === 2 ? 1 : 2;
    digit = Math.floor(digit / 36) + (digit % 36);
    sum += digit;
  }
  return CODE[(36 - (sum % 36)) % 36];
}

/**
 * Full GSTIN validation: 15 chars, correct structure, embedded valid state code
 * and PAN, and a matching checksum digit.
 */
export function isValidGSTIN(gstin: string): boolean {
  const g = (gstin || "").trim().toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return false;
  if (!isValidStateCode(g.slice(0, 2))) return false;
  if (!isValidPAN(g.slice(2, 12))) return false;
  return gstinChecksumChar(g.slice(0, 14)) === g[14];
}

export const stateCodeFromGSTIN = (g: string) => (g || "").trim().slice(0, 2);
export const panFromGSTIN = (g: string) => (g || "").trim().toUpperCase().slice(2, 12);

/** 6-digit Indian PIN code (cannot start with 0). */
export function isValidPincode(pin: string): boolean {
  return /^[1-9][0-9]{5}$/.test((pin || "").trim());
}

export function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((email || "").trim());
}

/** Indian mobile/landline: 10 digits (mobiles start 6–9), optional +91 / 0 prefix. */
export function isValidPhone(phone: string): boolean {
  const d = (phone || "").replace(/[^\d]/g, "").replace(/^(0|91)/, "");
  return /^[6-9]\d{9}$/.test(d) || /^\d{10,11}$/.test(d);
}

/** HSN codes are 4, 6 or 8 digits. */
export function isValidHSN(code: string): boolean {
  return /^\d{4}(\d{2}(\d{2})?)?$/.test((code || "").trim());
}

/** SAC (services) codes are 6 digits, conventionally starting with 99. */
export function isValidSAC(code: string): boolean {
  return /^\d{6}$/.test((code || "").trim());
}

/**
 * Split a GST amount into CGST+SGST (intra-state) or IGST (inter-state).
 * `sameState` = supplier state code equals buyer/branch state code.
 */
export function gstBreakdown(taxable: number, ratePct: number, sameState: boolean) {
  const tax = (Number(taxable) || 0) * (Number(ratePct) || 0) / 100;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return sameState
    ? { cgst: r2(tax / 2), sgst: r2(tax / 2), igst: 0, total: r2(tax) }
    : { cgst: 0, sgst: 0, igst: r2(tax), total: r2(tax) };
}
