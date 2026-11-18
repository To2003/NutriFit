import { KCAL_PER_KG_FAT } from "./targets";

export const EMA_ALPHA = 0.1;
export const MIN_COMPLETE_DAYS = 10;
export const WINDOW_DAYS = 14;
export const MAX_WEEKLY_CHANGE_KCAL = 200;

export interface WeighIn {
  date: string; // YYYY-MM-DD
  kg: number;
}

/** Peso de tendencia: media móvil exponencial sobre los pesajes ordenados por fecha. */
export function emaTrend(weights: WeighIn[], alpha = EMA_ALPHA): (WeighIn & { trendKg: number })[] {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  let prev: number | null = null;
  return sorted.map((w) => {
    prev = prev === null ? w.kg : prev + alpha * (w.kg - prev);
    return { ...w, trendKg: prev };
  });
}

export function clampChange(previous: number, next: number, maxDelta: number): number {
  return Math.min(previous + maxDelta, Math.max(previous - maxDelta, next));
}

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export interface AdaptiveDay {
  date: string;
  intakeKcal: number | null;
  /** Día con registro completo (todas las comidas cargadas). */
  complete: boolean;
}

/**
 * TDEE adaptativo. Usa los últimos 14 días; exige ≥ 10 días completos y ≥ 7 días entre pesajes.
 * gasto_real ≈ ingesta_promedio − (Δpeso_tendencia × 7700 / días).
 * Propuesta = promedio(anterior, observado), con cambio máximo de ±200 kcal.
 */
export function adaptiveTdee(input: {
  days: AdaptiveDay[];
  weights: WeighIn[];
  previousTdee: number;
}): { observedTdee: number; proposedTdee: number; completeDays: number } | null {
  const days = [...input.days].sort((a, b) => a.date.localeCompare(b.date)).slice(-WINDOW_DAYS);
  if (days.length === 0) return null;
  const complete = days.filter((d) => d.complete && d.intakeKcal !== null);
  if (complete.length < MIN_COMPLETE_DAYS) return null;

  const from = days[0].date;
  const to = days[days.length - 1].date;
  const trend = emaTrend(input.weights.filter((w) => w.date >= from && w.date <= to));
  if (trend.length < 2) return null;
  const first = trend[0];
  const last = trend[trend.length - 1];
  const span = daysBetween(first.date, last.date);
  if (span < 7) return null;

  const avgIntake = complete.reduce((s, d) => s + (d.intakeKcal ?? 0), 0) / complete.length;
  const deltaKg = last.trendKg - first.trendKg;
  const observedTdee = avgIntake - (deltaKg * KCAL_PER_KG_FAT) / span;
  const averaged = Math.round((input.previousTdee + observedTdee) / 2 / 10) * 10;
  return {
    observedTdee,
    proposedTdee: clampChange(input.previousTdee, averaged, MAX_WEEKLY_CHANGE_KCAL),
    completeDays: complete.length,
  };
}
