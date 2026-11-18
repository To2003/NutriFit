import type { PlanExercise, WeekPlan } from "./types";

export interface MesoWeek {
  week: number;
  isDeload: boolean;
  sessions: { weekday: number; name: string; exercises: PlanExercise[] }[];
}

/**
 * Mesociclo de 4 semanas: 3 de carga progresiva + 1 de descarga.
 * - RIR: base, base−1, base−2 (mínimo 1); descarga RIR 4.
 * - Semana 3: +1 serie en los ejercicios principales (máx. 5).
 * - Descarga: ~60 % de las series (mínimo 1).
 */
export function expandMesocycle(week: WeekPlan, opts: { mainExerciseIds: Set<string>; weeks?: number }): MesoWeek[] {
  const total = opts.weeks ?? 4;
  const out: MesoWeek[] = [];
  for (let w = 1; w <= total; w++) {
    const isDeload = w === total && total >= 3;
    out.push({
      week: w,
      isDeload,
      sessions: week.sessions.map((s) => ({
        weekday: s.weekday,
        name: isDeload ? `${s.name} · descarga` : s.name,
        exercises: s.exercises.map((e) => {
          const baseRir = e.rir ?? 2;
          if (isDeload) return { ...e, sets: Math.max(1, Math.round(e.sets * 0.6)), rir: 4 };
          const rir = Math.max(1, baseRir - (w - 1));
          const sets = w === 3 && opts.mainExerciseIds.has(e.exerciseId) ? Math.min(5, e.sets + 1) : e.sets;
          return { ...e, sets, rir };
        }),
      })),
    });
  }
  return out;
}
