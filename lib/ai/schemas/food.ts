import { z } from "zod";

const num = (max: number) => z.number().min(0).max(max);

export const aiFoodItemSchema = z.object({
  nombre: z.string().min(1).max(80),
  cantidad: num(50),
  unidad: z.string().max(30),
  gramos_estimados: num(3000),
  kcal: num(5000),
  proteina: num(300),
  carbos: num(600),
  grasa: num(300),
  confianza: z.number().min(0).max(1),
});
export type AIFoodItem = z.infer<typeof aiFoodItemSchema>;

export const aiFoodParseSchema = z.object({
  items: z.array(aiFoodItemSchema).max(15),
  /** Comentario corto si no se pudo identificar algo (opcional). */
  nota: z.string().max(200).optional(),
});
export type AIFoodParse = z.infer<typeof aiFoodParseSchema>;
