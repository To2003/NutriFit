import "server-only";
import { z } from "zod";
import type { ServerClient } from "@/lib/supabase/server";
import type { Me } from "@/lib/data/me";
import { getAI } from "@/lib/ai/provider";
import { runAI } from "@/lib/ai/run";
import { profileContext } from "@/lib/ai/context";
import { PROFE_PERSONA } from "@/lib/ai/prompts/persona";
import { addDays, daysBetween, isoWeekday, weekStart } from "@/lib/dates";
import { adaptiveTdee, emaTrend } from "@/lib/calc/tdee";
import { buildTargetInputs, computeWeek } from "@/lib/data/targets";
import { kcalFloor } from "@/lib/calc/targets";
import { violatesGuardrails } from "./guardrails";
import { lowIntakeAlert, LOW_INTAKE_MESSAGE } from "./low-intake";

const schema = z.object({
  tendencia: z.string().min(3).max(240),
  adherencia: z.string().min(3).max(240),
  gym: z.string().min(3).max(240),
  objetivos: z.array(z.string().min(3).max(120)).length(3),
  evaluacion: z.array(z.object({ id: z.string(), cumplido: z.boolean() })).max(5),
});

export interface WeeklyStats {
  weekStart: string;
  daysLogged: number;
  avgKcal: number | null;
  avgKcalTarget: number | null;
  proteinDays: number;
  waterDays: number;
  weightDeltaKg: number | null;
  trendKg: number | null;
  sessionsDone: number;
  sessionsPlanned: number;
  volumeKg: number;
  prs: string[];
}

export function fallbackWeeklyGoals(s: WeeklyStats): string[] {
  const out: string[] = [];
  if (s.daysLogged < 5) out.push("Cargar las comidas al menos 5 días");
  if (s.proteinDays < 5) out.push("Llegar a la proteína 5 de 7 días");
  if (s.waterDays < 5) out.push("Cumplir el agua 5 días (botella siempre a mano)");
  if (s.sessionsPlanned > 0 && s.sessionsDone < s.sessionsPlanned) out.push(`Hacer las ${s.sessionsPlanned} sesiones de gym`);
  const extras = ["Sumar una fruta por día", "Dormir 8 horas antes de los partidos", "Pesarte 3 mañanas en ayunas", "Una comida con verdura en almuerzo y cena"];
  for (const e of extras) if (out.length < 3) out.push(e);
  return out.slice(0, 3);
}

/** Revisión semanal (domingo): tendencia, adherencia, TDEE adaptativo, gym y 3 objetivos tildables. */
export async function generateWeeklyReview(supabase: ServerClient, me: Me): Promise<{ text: string } | null> {
  // La semana que se revisa termina hoy (domingo) o la última completa
  const today = me.today;
  const ws = isoWeekday(today) === 7 ? weekStart(today) : addDays(weekStart(today), -7);
  const we = addDays(ws, 6);
  const existing = await supabase.from("agent_messages").select("content").eq("user_id", me.userId).eq("kind", "weekly_review").eq("for_date", ws).maybeSingle();
  if (existing.data) return existing.data.content as { text: string };

  const from14 = addDays(we, -13);
  const [foods, water, weights, workouts, prevGoals, prs] = await Promise.all([
    supabase.from("food_logs").select("log_date, food_log_items(kcal, protein_g)").eq("user_id", me.userId).gte("log_date", from14).lte("log_date", we),
    supabase.from("water_logs").select("log_date, ml").eq("user_id", me.userId).gte("log_date", ws).lte("log_date", we),
    supabase.from("weight_logs").select("log_date, kg").eq("user_id", me.userId).gte("log_date", addDays(we, -27)).lte("log_date", we),
    supabase.from("workout_sessions").select("log_date, volume_kg").eq("user_id", me.userId).gte("log_date", ws).lte("log_date", we).not("ended_at", "is", null),
    supabase.from("weekly_goals").select("id, text, done").eq("user_id", me.userId).eq("week_start", ws),
    supabase.from("agent_messages").select("content").eq("user_id", me.userId).eq("kind", "workout_feedback").gte("for_date", ws).lte("for_date", we),
  ]);

  const inputs = buildTargetInputs({ details: me.details, weightKg: me.latestWeight?.kg, schedule: me.schedule, gym: me.gym, goals: me.goals });
  const week = inputs ? computeWeek(inputs) : null;

  const byDay = new Map<string, { meals: number; kcal: number; protein: number; water: number }>();
  const g = (d: string) => byDay.get(d) ?? (byDay.set(d, { meals: 0, kcal: 0, protein: 0, water: 0 }), byDay.get(d)!);
  for (const f of foods.data ?? []) {
    const d = g(f.log_date);
    d.meals++;
    for (const i of f.food_log_items ?? []) {
      d.kcal += Number(i.kcal);
      d.protein += Number(i.protein_g);
    }
  }
  for (const w of water.data ?? []) g(w.log_date).water += w.ml;
  const thisWeek = [...byDay.entries()].filter(([d]) => d >= ws && d <= we);
  const logged = thisWeek.filter(([, d]) => d.meals >= 3);
  const tFor = (d: string) => week?.days[isoWeekday(d)];
  const trend = emaTrend((weights.data ?? []).map((w) => ({ date: w.log_date, kg: Number(w.kg) })));
  const inWeek = trend.filter((t) => t.date >= ws);
  const before = trend.filter((t) => t.date < ws);
  const startTrend = before.length ? before[before.length - 1].trendKg : inWeek[0]?.trendKg;
  const endTrend = inWeek.length ? inWeek[inWeek.length - 1].trendKg : null;

  const stats: WeeklyStats = {
    weekStart: ws,
    daysLogged: logged.length,
    avgKcal: logged.length ? Math.round(logged.reduce((s, [, d]) => s + d.kcal, 0) / logged.length) : null,
    avgKcalTarget: week ? Math.round(Object.values(week.days).reduce((s, d) => s + d.kcal, 0) / 7) : null,
    proteinDays: thisWeek.filter(([d, x]) => (tFor(d)?.proteinG ?? 0) > 0 && x.protein >= 0.9 * tFor(d)!.proteinG).length,
    waterDays: thisWeek.filter(([d, x]) => (tFor(d)?.waterMl ?? 0) > 0 && x.water >= tFor(d)!.waterMl).length,
    weightDeltaKg: endTrend != null && startTrend != null ? Math.round((endTrend - startTrend) * 100) / 100 : null,
    trendKg: endTrend != null ? Math.round(endTrend * 10) / 10 : null,
    sessionsDone: (workouts.data ?? []).length,
    sessionsPlanned: me.gym?.weekdays?.length ?? 0,
    volumeKg: Math.round((workouts.data ?? []).reduce((s, w) => s + Number(w.volume_kg ?? 0), 0)),
    prs: (prs.data ?? []).flatMap((m) => ((m.content as { prs?: { exercise: string }[] })?.prs ?? []).map((p) => p.exercise)),
  };

  // TDEE adaptativo: desde la semana 3 de uso, ≥10 días completos en 14
  let tdee: { previous: number; observed: number; proposed: number } | null = null;
  const firstGoal = await supabase.from("user_goals").select("created_at").eq("user_id", me.userId).order("created_at").limit(1).maybeSingle();
  const weeksOfUse = firstGoal.data ? daysBetween(firstGoal.data.created_at.slice(0, 10), today) / 7 : 0;
  if (weeksOfUse >= 2 && me.goals?.tdee_estimate) {
    const days = Array.from({ length: 14 }, (_, i) => addDays(from14, i)).map((date) => {
      const d = byDay.get(date);
      return { date, intakeKcal: d ? d.kcal : null, complete: Boolean(d && d.meals >= 3) };
    });
    const r = adaptiveTdee({ days, weights: (weights.data ?? []).map((w) => ({ date: w.log_date, kg: Number(w.kg) })), previousTdee: Number(me.goals.tdee_estimate) });
    if (r && Math.abs(r.proposedTdee - Number(me.goals.tdee_estimate)) >= 50) {
      tdee = { previous: Number(me.goals.tdee_estimate), observed: Math.round(r.observedTdee), proposed: r.proposedTdee };
      await supabase.from("tdee_proposals").insert({
        user_id: me.userId,
        week_start: ws,
        previous_tdee: tdee.previous,
        observed_tdee: tdee.observed,
        proposed_tdee: tdee.proposed,
      });
    }
  }

  const floor = week ? kcalFloor(week.days[1].bmrKcal, (me.details.sex as "male" | "female") ?? "male") : 1500;
  const alert = lowIntakeAlert(logged.map(([, d]) => ({ meals: d.meals, kcal: d.kcal })), floor);
  const prev = prevGoals.data ?? [];

  const out = await runAI({
    supabase,
    call: async () => {
      const r = await getAI().generateJSON({
        system: `${PROFE_PERSONA}
Hacé la revisión semanal en 3 bloques cortos: "tendencia" (peso de tendencia, sin juzgar el número), "adherencia" (registro, proteína, agua), "gym" (sesiones, volumen, récords). Proponé 3 "objetivos" concretos y medibles para la semana que viene (cortos, tildables). En "evaluacion" decí cuáles de los objetivos anteriores (por id) se cumplieron según los datos.${alert ? "\nIMPORTANTE: comió muy por debajo de lo necesario varios días. No felicites; sugerí con tacto ver a un profesional." : ""}${me.details.goal === "lose_fat" ? "" : "\nEl objetivo no es bajar de peso: no hables de bajar."}`,
        prompt: JSON.stringify({ semana: stats, ajuste_tdee: tdee, objetivos_anteriores: prev, perfil: profileContext(me) }),
        schema,
        temperature: 0.6,
      });
      if (violatesGuardrails([r.tendencia, r.adherencia, r.gym, ...r.objetivos].join(" "))) throw new Error("guardrail");
      return r;
    },
    fallback: () => ({
      tendencia:
        stats.trendKg == null
          ? "Pesate unas mañanas esta semana así vemos la tendencia."
          : `Tendencia: ${stats.trendKg.toLocaleString("es-AR")} kg (${stats.weightDeltaKg != null && stats.weightDeltaKg !== 0 ? `${stats.weightDeltaKg > 0 ? "+" : ""}${stats.weightDeltaKg.toLocaleString("es-AR")} kg en la semana` : "estable"}).`,
      adherencia: `Cargaste ${stats.daysLogged} de 7 días, llegaste a la proteína ${stats.proteinDays} y al agua ${stats.waterDays}.`,
      gym: stats.sessionsPlanned ? `Hiciste ${stats.sessionsDone} de ${stats.sessionsPlanned} sesiones${stats.prs.length ? ` y rompiste récord en ${stats.prs[0]}` : ""}.` : "Sin gym planificado esta semana.",
      objetivos: fallbackWeeklyGoals(stats),
      evaluacion: [] as { id: string; cumplido: boolean }[],
    }),
  });
  const r = out.data;

  for (const e of r.evaluacion) if (prev.some((p) => p.id === e.id)) await supabase.from("weekly_goals").update({ done: e.cumplido, evaluated: true }).eq("id", e.id).eq("user_id", me.userId);
  const nextWeek = addDays(ws, 7);
  const existingNext = await supabase.from("weekly_goals").select("id").eq("user_id", me.userId).eq("week_start", nextWeek).limit(1);
  if (!existingNext.data?.length) await supabase.from("weekly_goals").insert(r.objetivos.map((text) => ({ user_id: me.userId, week_start: nextWeek, text })));

  const extra = alert ? ` ${LOW_INTAKE_MESSAGE}` : "";
  const tdeeText = tdee ? ` Según tus datos gastás unas ${tdee.observed} kcal; te propongo ajustar tu base a ${tdee.proposed}. Lo aceptás desde Inicio.` : "";
  const content = { ...r, stats, tdee, alert, text: `${r.tendencia} ${r.adherencia} ${r.gym}${tdeeText}${extra}` };
  await supabase.from("agent_messages").insert({ user_id: me.userId, kind: "weekly_review", for_date: ws, content: content as never, source: out.source });
  return content;
}
