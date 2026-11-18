export interface SetLike {
  exerciseId: string;
  kg: number;
  reps: number;
}

/** 1RM estimado (Epley): kg × (1 + reps/30). */
export function epley1RM(kg: number, reps: number): number {
  if (kg <= 0 || reps <= 0) return 0;
  if (reps === 1) return kg;
  return kg * (1 + reps / 30);
}

/** Volumen: Σ kg × reps (cada elemento es una serie). */
export function sessionVolume(sets: SetLike[]): number {
  return sets.reduce((sum, s) => sum + Math.max(0, s.kg) * Math.max(0, s.reps), 0);
}

export function volumeByMuscle(sets: SetLike[], musclesByExercise: Record<string, string[]>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sets) {
    for (const m of musclesByExercise[s.exerciseId] ?? []) {
      out[m] = (out[m] ?? 0) + Math.max(0, s.kg) * Math.max(0, s.reps);
    }
  }
  return out;
}

/** Mejor 1RM estimado de una lista de series. */
export function best1RM(sets: { kg: number; reps: number }[]): number {
  return sets.reduce((best, s) => Math.max(best, epley1RM(s.kg, s.reps)), 0);
}
