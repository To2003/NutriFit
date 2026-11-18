import type { PlanExercise, WeekPlan } from "./types";

export interface MesoWeek {
  week: number;
  isDeload: boolean;
  sessions: { weekday: number; name: string; exercises: PlanExercise[] }[];
}

/**
 * Mesociclo de 4 semanas: 3 de carga progresiva + 1 de descarga.
 * - RIR: base, base−1, base−2 (mínimo 1; prevención con base ≥ 3, mínimo 2); descarga RIR 4. Sin RIR → sin RIR.
 * - Días livianos (MD±1) quedan igual las 3 semanas de carga.
 * - Semana 3: +1 serie en los ejercicios principales (máx. 5).
 * - Descarga: ~60 % de las series (mínimo 1).
 */
export function expandMesocycle(
  week: WeekPlan,
  opts: { mainExerciseIds: Set<string>; weeks?: number; /** días MD±1: no se progresan */ lightWeekdays?: Set<number> },
): MesoWeek[] {
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
          if (isDeload) return { ...e, sets: Math.max(1, Math.round(e.sets * 0.6)), rir: e.rir == null ? null : 4 };
          if (opts.lightWeekdays?.has(s.weekday)) return { ...e };
          // sin RIR (movilidad, saltos, acondicionamiento): se mantiene
          const floor = !opts.mainExerciseIds.has(e.exerciseId) && e.rir != null && e.rir >= 3 ? 2 : 1;
          const rir = e.rir == null ? null : Math.max(floor, e.rir - (w - 1));
          const sets = w === 3 && opts.mainExerciseIds.has(e.exerciseId) ? Math.min(5, e.sets + 1) : e.sets;
          return { ...e, sets, rir };
        }),
      })),
    });
  }
  return out;
}
