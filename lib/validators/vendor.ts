import { z } from "zod";
import { isValidGSTIN, isValidStateCode, isValidPhone } from "@/lib/validators/gst";

const optional = (s?: string) => !s || s.trim() === "";

export const vendorSchema = z.object({
  name: z.string().min(1, "Name required"),
  gstin: z.string().optional().refine((v) => optional(v) || isValidGSTIN((v || "").toUpperCase()), {
    message: "Enter a valid 15-character GSTIN (format + checksum)",
  }),
  state_code: z.string().optional().refine((v) => optional(v) || isValidStateCode(v || ""), {
    message: "State code must be a valid GST state code (01–38)",
  }),
  phone: z.string().optional().refine((v) => optional(v) || isValidPhone(v || ""), {
    message: "Enter a valid 10-digit phone number",
  }),
  email: z.string().email().optional().or(z.literal("")),
  payment_terms_days: z.coerce.number().min(0).default(0),
});
export type VendorInput = z.infer<typeof vendorSchema>;
