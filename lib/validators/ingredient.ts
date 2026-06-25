import { z } from "zod";
export const ingredientSchema = z.object({
  name: z.string().min(1, "Name required"),
  sku: z.string().optional(),
  hsn_code: z.string().optional(),
  default_gst_rate: z.coerce.number().min(0).max(28).default(0),
  reorder_level: z.coerce.number().min(0).default(0),
});
export type IngredientInput = z.infer<typeof ingredientSchema>;
