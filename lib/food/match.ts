import { tokens } from "@/lib/text";
import type { FoodRow } from "./types";

/** Puntaje 0–1 de qué tan bien un alimento de la base corresponde a un nombre libre. */
export function matchScore(query: string, food: Pick<FoodRow, "name" | "aliases">): number {
  const q = tokens(query);
  if (q.length === 0) return 0;
  let best = 0;
  for (const candidate of [food.name, ...(food.aliases ?? [])]) {
    const f = tokens(candidate);
    if (f.length === 0) continue;
    const fs = new Set(f);
    const hits = q.filter((t) => fs.has(t) || f.some((x) => x.startsWith(t) || t.startsWith(x))).length;
    // cobertura de la query y precisión respecto del nombre del alimento
    const recall = hits / q.length;
    const precision = hits / f.length;
    const score = 0.65 * recall + 0.35 * precision;
    best = Math.max(best, score);
  }
  return best;
}

export const MATCH_THRESHOLD = 0.6;

export function bestMatch<T extends Pick<FoodRow, "name" | "aliases">>(query: string, foods: T[]): { food: T; score: number } | null {
  let best: { food: T; score: number } | null = null;
  for (const food of foods) {
    const score = matchScore(query, food);
    if (!best || score > best.score) best = { food, score };
  }
  return best && best.score >= MATCH_THRESHOLD ? best : null;
}
