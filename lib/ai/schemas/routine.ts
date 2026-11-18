import { z } from "zod";

export const aiRoutineSchema = z.object({
  nombre: z.string().min(2).max(60),
  sesiones: z
    .array(
      z.object({
        dia: z.number().int().min(1).max(7),
        nombre: z.string().min(2).max(50),
        ejercicios: z
          .array(
            z.object({
              id: z.string().min(2).max(60),
              series: z.number().int().min(1).max(6),
              reps_min: z.number().int().min(1).max(30),
              reps_max: z.number().int().min(1).max(40),
              descanso_s: z.number().int().min(0).max(300),
              rir: z.number().int().min(0).max(5).nullable(),
              notas: z.string().max(140),
            }),
          )
          .min(2)
          .max(10),
      }),
    )
    .min(1)
    .max(6),
  explicacion: z.string().max(400),
});
export type AIRoutine = z.infer<typeof aiRoutineSchema>;
