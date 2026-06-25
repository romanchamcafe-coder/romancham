import { z } from "zod";
export const vendorSchema = z.object({
  name: z.string().min(1, "Name required"),
  gstin: z.string().optional(),
  state_code: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  payment_terms_days: z.coerce.number().min(0).default(0),
});
export type VendorInput = z.infer<typeof vendorSchema>;
