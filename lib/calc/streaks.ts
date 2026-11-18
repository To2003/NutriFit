const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/**
 * Racha diaria: días consecutivos cumplidos terminando hoy (o ayer, si hoy todavía no se cumplió).
 */
export function currentStreak(days: Set<string>, today: string): { current: number; best: number } {
  if (days.size === 0) return { current: 0, best: 0 };
  let cursor = days.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current) };
}

/** Qué rachas diarias cumple un día. */
export function dailyStreakFlags(d: { meals: number; waterMl: number; waterTarget: number; proteinG: number; proteinTarget: number }) {
  return {
    logging: d.meals >= 3,
    water: d.waterTarget > 0 && d.waterMl >= d.waterTarget,
    protein: d.proteinTarget > 0 && d.proteinG >= 0.9 * d.proteinTarget,
  };
}

/** Racha semanal de entreno: semanas consecutivas cumpliendo las sesiones planificadas. */
export function trainingWeekStreak(
  weeks: { weekStart: string; planned: number; done: number }[],
  currentWeekStart: string,
): { current: number; best: number } {
  const sorted = [...weeks].filter((w) => w.planned > 0).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  let best = 0;
  let run = 0;
  let current = 0;
  for (const w of sorted) {
    const ongoing = w.weekStart === currentWeekStart;
    if (w.done >= w.planned) {
      run++;
      best = Math.max(best, run);
    } else if (!ongoing) run = 0;
  }
  current = run;
  return { current, best };
}
