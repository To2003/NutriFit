import { z } from "zod";
import { ageFromBirthdate } from "@/lib/calc/bmr";
import { SPORTS } from "@/lib/calc/types";

export const TOTAL_STEPS = 10;
export const RESERVED_USERNAMES = ["ajustes", "progreso", "logros", "buscar", "solicitudes", "seguidores", "siguiendo", "admin", "nutrifit", "profe"];
export const MIN_AGE = 18;

const time = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Hora inválida")
  .transform((s) => s.slice(0, 5));
const optionalTime = z.union([time, z.literal(""), z.null()]).optional().transform((v) => (v ? v : null));

export const basicsSchema = z.object({
  display_name: z.string().trim().min(1, "Poné cómo te llamamos").max(40),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_.]{3,24}$/, "Entre 3 y 24: letras, números, punto o guion bajo")
    .refine((u) => !RESERVED_USERNAMES.includes(u), "Ese usuario está reservado"),
  birthdate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .refine((d) => ageFromBirthdate(d) >= MIN_AGE, `NutriFit es para mayores de ${MIN_AGE}`)
    .refine((d) => ageFromBirthdate(d) <= 100, "Revisá la fecha"),
  sex: z.enum(["male", "female"], { message: "Elegí una opción" }),
  height_cm: z.coerce.number().min(120, "Revisá la altura").max(230, "Revisá la altura"),
  weight_kg: z.coerce.number().min(35, "Revisá el peso").max(250, "Revisá el peso"),
});

export const goalSchema = z.object({
  goal: z.enum(["lose_fat", "recomp", "maintain", "gain_muscle", "performance"], { message: "Elegí un objetivo" }),
  pace: z.enum(["easy", "moderate", "fast"]).default("moderate"),
});

export const lifestyleSchema = z.object({
  lifestyle: z.enum(["sedentary", "mixed", "standing", "physical"], { message: "Elegí una opción" }),
});

export const sportsSchema = z.object({
  sports: z
    .array(
      z.object({
        sport: z.enum(SPORTS),
        position: z.string().trim().max(40).nullable().optional(),
        level: z.enum(["recreational", "amateur", "federated"]).default("amateur"),
      }),
    )
    .max(8),
});

export const scheduleEntrySchema = z.object({
  weekday: z.number().int().min(1).max(7),
  sport: z.enum(SPORTS),
  kind: z.enum(["training", "match"]),
  start_time: optionalTime,
  duration_min: z.coerce.number().int().min(5).max(600),
  intensity: z.enum(["light", "moderate", "hard"]),
});
export const scheduleSchema = z.object({ schedule: z.array(scheduleEntrySchema).max(30) });

export const gymSchema = z.object({
  weekdays: z.array(z.number().int().min(1).max(7)).max(7),
  minutes: z.coerce.number().int().min(15).max(180),
  preferred_time: optionalTime,
  equipment: z.array(z.string()).max(20),
  experience: z.enum(["beginner", "intermediate", "advanced"]),
  injuries: z.string().trim().max(500).default(""),
  allow_consecutive: z.boolean().default(false),
});

export const focusSchema = z
  .object({
    focus_primary: z.string().min(1, "Elegí un foco principal"),
    focus_secondary: z.string().nullable().optional(),
  })
  .refine((v) => v.focus_primary !== v.focus_secondary, { message: "El secundario tiene que ser distinto", path: ["focus_secondary"] });

export const dietSchema = z.object({
  diet_type: z.enum(["omnivore", "vegetarian", "vegan", "other"]),
  meals_per_day: z.coerce.number().int().min(1).max(8),
  dislikes: z.array(z.string().trim().min(1).max(40)).max(30),
  allergies: z.string().trim().max(300).default(""),
  cooking_time: z.enum(["low", "normal", "high"]),
});

export const notificationsSchema = z.object({
  enabled: z.boolean(),
  water_on: z.boolean(),
  water_every_h: z.coerce.number().int().min(1).max(6),
  meals_on: z.boolean(),
  gym_on: z.boolean(),
  daily_close_on: z.boolean(),
  daily_close_at: time,
  weekly_review: z.boolean(),
});

export const privacySchema = z.object({
  is_private: z.boolean(),
  show_streaks: z.boolean(),
  show_training: z.boolean(),
  show_tests: z.boolean(),
  show_meals: z.boolean(),
  show_body: z.boolean(),
  ai_notice: z.literal(true, { message: "Necesitamos que lo aceptes para usar al Profe" }),
});

export const STEP_SCHEMAS = {
  1: basicsSchema,
  2: goalSchema,
  3: lifestyleSchema,
  4: sportsSchema,
  5: scheduleSchema,
  6: gymSchema,
  7: focusSchema,
  8: dietSchema,
  9: notificationsSchema,
  10: privacySchema,
} as const;
export type StepNumber = keyof typeof STEP_SCHEMAS;

export const STEP_TITLES: Record<StepNumber, string> = {
  1: "Arranquemos por vos",
  2: "¿Qué querés lograr?",
  3: "Tu día a día",
  4: "Tus deportes",
  5: "Tu semana",
  6: "El gimnasio",
  7: "El foco de la rutina",
  8: "Cómo comés",
  9: "Recordatorios",
  10: "Privacidad",
};

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisá los datos";
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const k = i.path.join(".");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}
