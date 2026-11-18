import { metFor } from "./mets";
import type { Activity, DayType, Lifestyle } from "./types";

/** Factor de estilo de vida, SIN contar entrenamientos. */
export const LIFESTYLE_FACTOR: Record<Lifestyle, number> = {
  sedentary: 1.2,
  mixed: 1.3,
  standing: 1.4,
  physical: 1.5,
};

/** Gasto extra por ejercicio: (MET − 1) × kg × horas (se resta el MET de reposo). */
export function exerciseKcal(met: number, weightKg: number, durationMin: number): number {
  if (durationMin <= 0 || met <= 1) return 0;
  return (met - 1) * weightKg * (durationMin / 60);
}

export function activityKcal(a: Activity, weightKg: number): number {
  return exerciseKcal(metFor(a), weightKg, a.durationMin);
}

export function dayExpenditure(input: {
  bmrKcal: number;
  lifestyle: Lifestyle;
  weightKg: number;
  activities: Activity[];
  expenditureOffsetKcal?: number;
}): number {
  const exercise = input.activities.reduce((sum, a) => sum + activityKcal(a, input.weightKg), 0);
  return input.bmrKcal * LIFESTYLE_FACTOR[input.lifestyle] + exercise + (input.expenditureOffsetKcal ?? 0);
}

/** Actividades que no alcanzan para que el día cuente como "entreno". */
const NON_TRAINING: ReadonlySet<string> = new Set(["walking"]);

export function dayTypeOf(activities: Activity[]): DayType {
  const real = activities.filter((a) => a.durationMin > 0);
  if (real.some((a) => a.kind === "match")) return "match";
  if (real.some((a) => !NON_TRAINING.has(a.sport))) return "training";
  return "rest";
}

export function activityMinutes(activities: Activity[]): number {
  return activities.reduce((sum, a) => sum + Math.max(0, a.durationMin), 0);
}
