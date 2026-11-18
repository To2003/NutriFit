import { z } from "zod";
import { aiFoodItemSchema } from "./food";

export const aiSuggestSchema = z.object({
  opciones: z
    .array(
      z.object({
        nombre: z.string().min(2).max(70),
        receta: z.string().min(5).max(320),
        tiempo_min: z.number().int().min(1).max(120),
        ingredientes: z.array(aiFoodItemSchema).min(1).max(8),
      }),
    )
    .min(1)
    .max(3),
});
