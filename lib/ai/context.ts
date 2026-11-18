import "server-only";
import type { Me } from "@/lib/data/me";
import type { DaySummary } from "@/lib/data/day";
import { ageFromBirthdate } from "@/lib/calc/bmr";
import { DAY_TYPE_INFO, MEALS, SPORT_INFO, WEEKDAY_LABELS } from "@/lib/domain/catalog";
import { timeInTz } from "@/lib/dates";

/**
 * Contexto compacto para la IA. NUNCA incluye nombre, usuario, email ni ids.
 */
export function profileContext(me: Me) {
  return {
    edad: me.details.birthdate ? ageFromBirthdate(me.details.birthdate) : null,
    sexo: me.details.sex === "male" ? "masculino" : me.details.sex === "female" ? "femenino" : null,
    objetivo: me.details.goal,
    ritmo: me.details.pace,
    deportes: me.sports.map((s) => ({ deporte: SPORT_INFO[s.sport as keyof typeof SPORT_INFO]?.label ?? s.sport, posicion: s.position, nivel: s.level })),
    agenda: me.schedule.map((s) => ({
      dia: WEEKDAY_LABELS[s.weekday].long,
      deporte: SPORT_INFO[s.sport as keyof typeof SPORT_INFO]?.label ?? s.sport,
      tipo: s.kind === "match" ? "partido" : "entreno",
      hora: s.start_time?.slice(0, 5) ?? null,
      min: s.duration_min,
    })),
    gym_dias: (me.gym?.weekdays ?? []).map((d) => WEEKDAY_LABELS[d].long),
    alimentacion: {
      tipo: me.diet?.diet_type,
      no_le_gusta: me.diet?.dislikes ?? [],
      alergias: me.diet?.allergies || null,
      tiempo_cocina: me.diet?.cooking_time,
    },
  };
}

export function dayContext(me: Me, day: DaySummary) {
  const t = day.targets;
  return {
    fecha: day.date,
    hora_local: timeInTz(me.tz),
    tipo_dia: t ? DAY_TYPE_INFO[t.dayType].label : null,
    objetivo: t ? { kcal: t.kcal, proteina_g: t.proteinG, carbos_g: t.carbsG, grasa_g: t.fatG, agua_ml: t.waterMl } : null,
    consumido: { kcal: day.totals.kcal, proteina_g: day.totals.protein_g, carbos_g: day.totals.carbs_g, grasa_g: day.totals.fat_g, agua_ml: day.waterMl },
    comidas: day.meals.map((m) => ({
      momento: MEALS.find((x) => x.value === m.meal)?.label ?? m.meal,
      items: m.items.map((i) => `${i.name} (${Math.round(Number(i.grams))} g)`),
      kcal: m.kcal,
    })),
    actividades: [
      ...day.planned.map((p) => ({
        deporte: SPORT_INFO[p.sport]?.label ?? p.sport,
        tipo: p.kind === "match" ? "partido" : "entreno",
        estado: p.status === "pending" ? "pendiente" : p.status === "done" ? "hecho" : "no fue",
        min: p.log?.duration_min ?? p.duration_min,
      })),
      ...day.extraActivities.map((a) => ({ deporte: SPORT_INFO[a.sport as keyof typeof SPORT_INFO]?.label ?? a.sport, tipo: a.kind, estado: a.status, min: a.duration_min })),
      ...(day.workouts.length ? [{ deporte: "Gimnasio", tipo: "entreno", estado: "hecho", min: day.workouts[0].duration_min }] : []),
    ],
  };
}
