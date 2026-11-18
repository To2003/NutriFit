/**
 * Simulador: una semana de un punta de vóley que juega hockey y está bajando grasa.
 * Muestra qué devuelve cada intervención del agente. Con GEMINI_API_KEY usa Gemini; si no, los fallbacks.
 *   pnpm sim:agent
 */
import { it } from "vitest";
import { z } from "zod";
import { weekTargets } from "@/lib/calc/week";
import { fallbackDailyClose, fallbackLogFeedback, type DaySnapshot } from "@/lib/agent/fallbacks";
import { fallbackWeeklyGoals } from "@/lib/agent/weekly";
import { fallbackIdeas } from "@/lib/agent/suggest-fallback";
import { fallbackWorkoutFeedback } from "@/lib/agent/workout";
import { violatesGuardrails } from "@/lib/agent/guardrails";
import { generateRulePlan } from "@/lib/training/templates";
import { EXERCISE_LIBRARY, LIBRARY_BY_ID } from "@/lib/training/library-data";
import { getAI } from "@/lib/ai/provider";
import { PROFE_PERSONA } from "@/lib/ai/prompts/persona";
import { DAY_TYPE_INFO, WEEKDAY_LABELS } from "@/lib/domain/catalog";

const schedule = [
  { weekday: 2, sport: "volleyball" as const, kind: "training" as const, intensity: "moderate" as const, durationMin: 120 },
  { weekday: 3, sport: "field_hockey" as const, kind: "training" as const, intensity: "moderate" as const, durationMin: 90 },
  { weekday: 4, sport: "volleyball" as const, kind: "training" as const, intensity: "moderate" as const, durationMin: 120 },
  { weekday: 5, sport: "field_hockey" as const, kind: "training" as const, intensity: "moderate" as const, durationMin: 90 },
  { weekday: 6, sport: "volleyball" as const, kind: "match" as const, intensity: "hard" as const, durationMin: 120 },
  { weekday: 7, sport: "field_hockey" as const, kind: "match" as const, intensity: "hard" as const, durationMin: 70 },
];

// Lo que "comió" cada día (fracción del objetivo de kcal y proteína) y el agua
const week = [
  { kcal: 0.95, prot: 0.92, water: 1.0, meals: 4, note: "lunes ordenado" },
  { kcal: 1.25, prot: 0.6, water: 0.7, meals: 4, note: "martes: cumpleaños con pizza" },
  { kcal: 0.9, prot: 1.0, water: 1.05, meals: 5, note: "miércoles impecable" },
  { kcal: 0.85, prot: 0.75, water: 0.6, meals: 3, note: "jueves a las apuradas" },
  { kcal: 0.97, prot: 0.95, water: 1.0, meals: 4, note: "viernes previa al partido" },
  { kcal: 0.6, prot: 0.7, water: 0.8, meals: 3, note: "sábado: partido, comió poco" },
  { kcal: 1.0, prot: 0.9, water: 0.9, meals: 4, note: "domingo hockey" },
];

const useAI = Boolean(process.env.GEMINI_API_KEY);
const line = (s = "") => console.log(s);

async function ai(system: string, prompt: string): Promise<string | null> {
  if (!useAI) return null;
  try {
    const r = await getAI().generateJSON({ system: `${PROFE_PERSONA}\n${system}`, prompt, schema: z.object({ mensaje: z.string() }) });
    return violatesGuardrails(r.mensaje) ? `(bloqueado por guardrail) ${r.mensaje}` : r.mensaje;
  } catch (e) {
    return `(IA falló: ${(e as Error).message.slice(0, 80)}) → fallback`;
  }
}

it("semana simulada de Toto", { timeout: 300_000 }, async () => {
  const t = weekTargets({ body: { sex: "male", ageYears: 23, heightCm: 185, weightKg: 85 }, goal: "lose_fat", pace: "moderate", lifestyle: "mixed", schedule, gym: { weekdays: [1, 3, 5], minutes: 60 } });
  line(`\n=== Objetivos (${useAI ? "con Gemini" : "sin IA: fallbacks"}) ===`);
  for (const [k, v] of Object.entries(t.byType)) if (v) line(`${DAY_TYPE_INFO[k as "rest"].label}: ${v.kcal} kcal · P ${v.proteinG} · C ${v.carbsG} · G ${v.fatG} · agua ${v.waterMl} ml (${v.weekdays.map((d) => WEEKDAY_LABELS[d].short).join(", ")})`);

  line("\n=== Rutina (reglas) ===");
  const plan = generateRulePlan({ gymDays: [1, 3, 5], minutes: 60, experience: "intermediate", equipment: ["full_gym"], injuries: "", focusPrimary: "jump", focusSecondary: "injury_prevention", events: schedule, allowConsecutive: false, sports: ["volleyball", "field_hockey"] }, EXERCISE_LIBRARY);
  for (const s of plan.sessions) line(`${WEEKDAY_LABELS[s.weekday].short} · ${s.name}: ${s.exercises.map((e) => LIBRARY_BY_ID[e.exerciseId].name).join(", ")}`);

  for (let i = 0; i < 7; i++) {
    const wd = i + 1;
    const dt = t.days[wd];
    const w = week[i];
    const snap: DaySnapshot = {
      dayType: dt.dayType,
      hour: 21,
      kcal: Math.round(dt.kcal * w.kcal),
      kcalTarget: dt.kcal,
      proteinG: Math.round(dt.proteinG * w.prot),
      proteinTarget: dt.proteinG,
      waterMl: Math.round(dt.waterMl * w.water),
      waterTarget: dt.waterMl,
      mealsCount: w.meals,
    };
    line(`\n=== ${WEEKDAY_LABELS[wd].long} (${DAY_TYPE_INFO[dt.dayType].label}) — ${w.note} ===`);
    const fbRule = fallbackLogFeedback(snap, "food", i);
    const fbAI = await ai("Respondé en 1–2 oraciones: cómo viene el día y un tip.", JSON.stringify({ evento: "cargó la cena", ...snap }));
    line(`Feedback por carga: ${fbAI ?? fbRule}`);
    line(`Feedback agua: ${fallbackLogFeedback(snap, "water", i)}`);
    const close = fallbackDailyClose({ ...snap, trained: true });
    const closeAI = await ai("Cierre del día en 2–3 oraciones: balance, algo bueno y 1 ajuste para mañana.", JSON.stringify(snap));
    line(`Cierre del día: ${closeAI ?? `${close.resumen} ✅ ${close.bien} 👉 ${close.ajuste}`}`);
    if ([1, 3, 5].includes(wd)) line(`Feedback de sesión: ${fallbackWorkoutFeedback({ sessionName: "Gym", durationMin: 58, volumeKg: 6200, feeling: 7, prs: wd === 3 ? [{ exercise: "Sentadilla trasera", e1rm: 121.7 }] : [], pain: [], isDeload: false })}`);
  }

  line("\n=== ¿Qué como? (cena, tiene huevos, arroz y atún) ===");
  for (const idea of fallbackIdeas({ meal: "dinner", diet: "omnivore", dislikes: [], allergies: "", cookingTime: "normal", pantry: "tengo huevos, arroz y atún", remaining: { kcal: 750, protein: 55 }, mealsLeft: 1 }))
    line(`- ${idea.nombre}: ${idea.kcal} kcal · P ${idea.proteina} — ${idea.receta}`);

  line("\n=== Revisión semanal: objetivos ===");
  for (const g of fallbackWeeklyGoals({ weekStart: "2026-11-30", daysLogged: 7, avgKcal: 2400, avgKcalTarget: 2560, proteinDays: 3, waterDays: 3, weightDeltaKg: -0.4, trendKg: 84.6, sessionsDone: 3, sessionsPlanned: 3, volumeKg: 18600, prs: ["Sentadilla trasera"] })) line(`☐ ${g}`);
});
