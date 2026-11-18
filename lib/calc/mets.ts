import type { Intensity, SessionKind, Sport } from "./types";

/**
 * MET por deporte e intensidad. Referencia: Compendium of Physical Activities (2011/2024).
 * `match` = valor para partido / competencia. Revisar con el uso real.
 */
export const MET_TABLE: Record<Sport, Record<Intensity | "match", number>> = {
  volleyball: { light: 3, moderate: 4, hard: 6, match: 6 },
  beach_volleyball: { light: 6, moderate: 8, hard: 8, match: 8 },
  field_hockey: { light: 4.5, moderate: 6, hard: 7, match: 7.8 },
  football: { light: 5, moderate: 7, hard: 8, match: 8 },
  basketball: { light: 4.5, moderate: 6.5, hard: 8, match: 8 },
  handball: { light: 6, moderate: 8, hard: 10, match: 10 },
  rugby: { light: 5, moderate: 6.3, hard: 8.3, match: 8.3 },
  padel_tennis: { light: 5, moderate: 6, hard: 7.3, match: 7.3 },
  running: { light: 6, moderate: 8.3, hard: 10.5, match: 10.5 },
  swimming: { light: 5.8, moderate: 7, hard: 9.8, match: 9.8 },
  cycling: { light: 4, moderate: 6.8, hard: 10, match: 10 },
  walking: { light: 3, moderate: 3.5, hard: 4.3, match: 4.3 },
  gym: { light: 3, moderate: 3.5, hard: 6, match: 6 },
  other: { light: 3.5, moderate: 5, hard: 7, match: 7 },
};

export function metFor(a: { sport: Sport; kind: SessionKind; intensity: Intensity }): number {
  const row = MET_TABLE[a.sport] ?? MET_TABLE.other;
  const byIntensity = row[a.intensity];
  return a.kind === "match" ? Math.max(row.match, byIntensity) : byIntensity;
}
