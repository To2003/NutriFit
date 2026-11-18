import type { DayType } from "@/lib/calc/types";

export interface DaySnapshot {
  dayType: DayType;
  hour: number;
  kcal: number;
  kcalTarget: number;
  proteinG: number;
  proteinTarget: number;
  waterMl: number;
  waterTarget: number;
  mealsCount: number;
}

const pct = (a: number, b: number) => (b > 0 ? a / b : 0);
const pick = <T,>(xs: T[], seed: number) => xs[Math.abs(Math.floor(seed)) % xs.length];

/** Feedback corto por reglas, para cuando la IA no está. Nunca culpabiliza. */
export function fallbackLogFeedback(s: DaySnapshot, kind: "food" | "water" | "weight" | "activity" | "workout", seed = Date.now()): string {
  const p = pct(s.proteinG, s.proteinTarget);
  const w = pct(s.waterMl, s.waterTarget);
  const k = pct(s.kcal, s.kcalTarget);
  const leftWater = Math.max(0, Math.round((s.waterTarget - s.waterMl) / 100) / 10);

  if (kind === "water") {
    if (w >= 1) return pick(["¡Meta de agua cumplida! 💧 Así da gusto.", "Agua al día, crack. El cuerpo te lo agradece 💧"], seed);
    return pick(
      [`Vas ${Math.round(w * 100)} % del agua. Te faltan ${leftWater.toLocaleString("es-AR")} L, de a poquito 💧`, `Bien ahí con el agua. Quedan ${leftWater.toLocaleString("es-AR")} L para hoy.`],
      seed,
    );
  }
  if (kind === "weight") {
    return pick(
      ["Anotado. Mirá la tendencia, no el número del día: el peso sube y baja por agua y sal.", "Listo el pesaje. Lo que importa es la línea de tendencia, no un día suelto."],
      seed,
    );
  }
  if (kind === "activity" || kind === "workout") {
    if (s.dayType === "match") return "¡A romperla! Hoy los carbos son tu nafta: no los esquives.";
    return pick(["Entreno anotado 💪 Acordate de la proteína en la próxima comida.", "Bien ahí. Recuperá con agua y una comida con proteína."], seed);
  }
  // comida
  if (s.dayType === "match" && k < 0.5 && s.hour >= 12) return "Día de partido: sumá carbos (arroz, fideos, pan) para llegar con nafta 🏆";
  if (p >= 0.9) return pick(["Proteína al día 🔥 Lo demás viene solo.", "Vas bárbaro con la proteína. Seguí así."], seed);
  if (p < 0.5 && s.hour >= 15)
    return pick(
      [`Vas ${Math.round(p * 100)} % de la proteína. En la próxima sumale huevo, pollo, atún o yogur.`, "Ojo que la proteína viene floja: un yogur o un par de huevos y estás."],
      seed,
    );
  if (k > 1.15) return "Hoy vino generoso, todo bien. Mañana seguimos con el plan de siempre, como si nada.";
  return pick(["Anotado 👌 Vas bien encaminado.", "Listo. Seguí cargando así que el Profe te puede ayudar mejor.", "Bien ahí. ¡Que no falte el agua!"], seed);
}

export interface DailyCloseFallback {
  resumen: string;
  bien: string;
  ajuste: string;
}

export function fallbackDailyClose(s: DaySnapshot & { trained: boolean }): DailyCloseFallback {
  const k = Math.round(pct(s.kcal, s.kcalTarget) * 100);
  const p = pct(s.proteinG, s.proteinTarget);
  const w = pct(s.waterMl, s.waterTarget);
  const bien =
    s.mealsCount === 0
      ? "Abriste la app, que ya es un montón."
      : p >= 0.9
        ? "La proteína quedó al día."
        : w >= 1
          ? "Cumpliste el agua."
          : s.trained
            ? "Entrenaste. Eso no te lo saca nadie."
            : `Cargaste ${s.mealsCount} ${s.mealsCount === 1 ? "comida" : "comidas"}.`;
  const ajuste =
    s.mealsCount < 3
      ? "Mañana probá cargar cada comida apenas la terminás: son 10 segundos."
      : p < 0.8
        ? "Mañana sumá una porción de proteína en el desayuno (huevos, yogur o queso)."
        : w < 0.8
          ? "Mañana llevá una botella a mano y tomá cada vez que la veas."
          : "Mañana repetimos la receta: viene funcionando.";
  return {
    resumen: s.mealsCount === 0 ? "Hoy no hubo cargas. Mañana arrancamos de nuevo, sin drama." : `Comiste ${k} % de tu objetivo de kcal y tomaste ${Math.round(w * 100)} % del agua.`,
    bien,
    ajuste,
  };
}
