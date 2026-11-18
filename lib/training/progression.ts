import type { LoadType, Region } from "./types";

export function roundToPlate(kg: number, step = 1.25): number {
  return Math.round(kg / step) * step;
}

/**
 * Doble progresión: si completaste el tope del rango de reps en TODAS las series con RIR ≥ 1,
 * la próxima sesión sube la carga (+2,5 kg tren superior, +5 kg tren inferior; mancuernas al siguiente par).
 */
export function nextLoad(args: {
  last: { kg: number; reps: number; rir: number | null }[];
  repsMax: number;
  region: Region;
  loadType: LoadType;
}): { kg: number | null; reason: "up" | "same" | "first_time" | "bodyweight" } {
  const { last, repsMax, region, loadType } = args;
  if (loadType === "bodyweight" || loadType === "band") return { kg: 0, reason: "bodyweight" };
  if (last.length === 0) return { kg: null, reason: "first_time" };
  const kg = Math.max(...last.map((s) => s.kg));
  const working = last.filter((s) => s.kg === kg);
  const done = working.every((s) => s.reps >= repsMax && (s.rir === null || s.rir >= 1));
  if (!done) return { kg, reason: "same" };
  let step: number;
  if (loadType === "dumbbell") step = 2;
  else if (loadType === "kettlebell") step = 4;
  else step = region === "lower" ? 5 : 2.5;
  return { kg: loadType === "dumbbell" || loadType === "kettlebell" ? kg + step : roundToPlate(kg + step), reason: "up" };
}
