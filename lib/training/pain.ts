import type { ExerciseInfo } from "./types";

/** Zonas que el usuario puede marcar → músculos que las cargan. */
export const PAIN_ZONES: { value: string; label: string; muscles: string[]; avoidHighImpact?: boolean }[] = [
  { value: "knee", label: "Rodilla", muscles: ["quads"], avoidHighImpact: true },
  { value: "ankle", label: "Tobillo", muscles: ["calves", "tibialis"], avoidHighImpact: true },
  { value: "shoulder", label: "Hombro", muscles: ["shoulders", "rotator_cuff"] },
  { value: "lower_back", label: "Zona lumbar", muscles: ["lower_back"] },
  { value: "hamstring", label: "Isquios", muscles: ["hamstrings"] },
  { value: "groin", label: "Aductores / ingle", muscles: ["adductors"] },
  { value: "hip", label: "Cadera", muscles: ["hip_flexors", "glutes"] },
  { value: "elbow_wrist", label: "Codo / muñeca", muscles: ["forearms", "biceps", "triceps"] },
  { value: "neck", label: "Cuello", muscles: ["neck"] },
  { value: "other", label: "Otra", muscles: [] },
];

export function loadsZone(e: ExerciseInfo, zone: string): boolean {
  const z = PAIN_ZONES.find((x) => x.value === zone);
  if (!z) return false;
  if (z.avoidHighImpact && e.impact === "high") return true;
  if (zone === "lower_back" && (e.heavy_lower || e.pattern === "hinge")) return true;
  return e.muscles.some((m) => z.muscles.includes(m));
}

/** Reemplazo para un ejercicio que carga la zona: alternativa que no la cargue, o null (se quita). */
export function painSafeReplacement(e: ExerciseInfo, zone: string, lib: Record<string, ExerciseInfo>): string | null {
  for (const alt of e.alternatives) {
    const a = lib[alt];
    if (a && !loadsZone(a, zone)) return alt;
  }
  return null;
}
