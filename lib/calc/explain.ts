import type { DayType, Goal, Pace, TargetNote } from "./types";
import { PACE_PCT_PER_WEEK } from "./targets";

const fmt = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);

/** Explicación en criollo de cómo se llegó a los objetivos. Determinística (no IA). */
export function explainTargets(args: {
  goal: Goal;
  pace: Pace;
  weightKg: number;
  bmrKcal: number;
  notes: TargetNote[];
  byTypeKcal: Partial<Record<DayType, number>>;
}): string[] {
  const out: string[] = [];
  out.push(`Tu cuerpo en reposo gasta unas ${fmt(args.bmrKcal)} kcal por día. A eso le sumamos tu día a día y lo que entrenás.`);
  if (args.goal === "lose_fat") {
    const kg = (args.weightKg * PACE_PCT_PER_WEEK[args.pace]) / 100;
    out.push(
      `Para bajar unos ${kg.toLocaleString("es-AR", { maximumFractionDigits: 2 })} kg por semana comés un poco menos de lo que gastás, todos los días igual de déficit.`,
    );
  } else if (args.goal === "recomp") {
    out.push("Para recomponer comés apenas por debajo de lo que gastás, con mucha proteína.");
  } else if (args.goal === "gain_muscle") {
    out.push("Para ganar músculo comés un poquito más de lo que gastás. Sin pasarse: la idea es crecer limpio.");
  } else {
    out.push("Comés lo que gastás: la idea es que te dé la nafta para rendir.");
  }
  if (args.byTypeKcal.match && args.byTypeKcal.rest) {
    out.push(
      `Los días de partido comés ${fmt(args.byTypeKcal.match - args.byTypeKcal.rest)} kcal más que los de descanso, casi todo en carbohidratos: es la nafta para jugar.`,
    );
  }
  if (args.notes.includes("kcal_floor")) {
    out.push("Algún día el cálculo daba muy bajo, así que lo subimos al piso: nunca te vamos a pedir comer menos que eso.");
  }
  if (args.notes.includes("deficit_capped")) {
    out.push("El ritmo que elegiste pedía un déficit muy grande, así que lo limitamos al 25 % de lo que gastás.");
  }
  if (args.notes.includes("carb_floor_kcal_raised") || args.notes.includes("carb_floor_fat_reduced")) {
    out.push("Los días que entrenás te aseguramos al menos 3 g de carbohidratos por kilo para que rindas y te recuperes bien.");
  }
  out.push("La proteína es la misma todos los días: es lo que cuida el músculo.");
  return out;
}
