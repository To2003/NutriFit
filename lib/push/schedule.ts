import { hmToMin } from "@/lib/dates";

/** ¿`now` (HH:MM) cae dentro del horario de silencio? Soporta rangos que cruzan medianoche. */
export function inQuietHours(now: string, from: string, to: string): boolean {
  const n = hmToMin(now);
  const f = hmToMin(from);
  const t = hmToMin(to);
  if (f === t) return false;
  return f < t ? n >= f && n < t : n >= f || n < t;
}

/** ¿El cron de 15 min está en la ventana de `at`? (at ≤ now < at + 15) */
export function inWindow(now: string, at: string, windowMin = 15): boolean {
  const n = hmToMin(now);
  const a = hmToMin(at);
  return n >= a && n < a + windowMin;
}

/** Recordatorio de agua: cada `everyH` horas entre `from` y `to`, en el primer bloque de 15 min de esa hora. */
export function waterSlot(now: string, from: string, to: string, everyH: number): number | null {
  const n = hmToMin(now);
  const f = hmToMin(from);
  const t = hmToMin(to);
  if (n < f || n > t) return null;
  const sinceStart = n - f;
  const slot = Math.floor(sinceStart / 60);
  if (slot === 0 || slot % everyH !== 0) return null;
  return sinceStart % 60 < 15 ? slot : null;
}
