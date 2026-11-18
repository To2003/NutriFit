import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import type { Me } from "@/lib/data/me";
import { getAI } from "@/lib/ai/provider";
import { runAI } from "@/lib/ai/run";
import { aiRoutineSchema } from "@/lib/ai/schemas/routine";
import { ROUTINE_SYSTEM } from "@/lib/ai/prompts/routine";
import { profileContext } from "@/lib/ai/context";
import { EXERCISE_LIBRARY, LIBRARY_BY_ID } from "./library-data";
import { allowedExercises, exercisesPerSession, generateRulePlan, pickSessionDays, type GeneratorInput } from "./templates";
import { dayRestriction, fixPlan, validatePlan } from "./rules";
import { expandMesocycle } from "./mesocycle";
import type { PlacementContext, WeekPlan } from "./types";
import { weekStart } from "@/lib/dates";
import { FOCUSES, WEEKDAY_LABELS } from "@/lib/domain/catalog";

export function generatorInputFromMe(me: Me, extraInjuries = ""): GeneratorInput {
  return {
    gymDays: me.gym?.weekdays ?? [],
    minutes: me.gym?.minutes ?? 60,
    experience: (me.gym?.experience as GeneratorInput["experience"]) ?? "beginner",
    equipment: me.gym?.equipment?.length ? me.gym.equipment : ["full_gym"],
    injuries: [me.gym?.injuries ?? "", extraInjuries].filter(Boolean).join(". "),
    focusPrimary: me.details.focus_primary,
    focusSecondary: me.details.focus_secondary,
    events: me.schedule.map((s) => ({ weekday: s.weekday, sport: s.sport, kind: s.kind as "training" | "match", durationMin: s.duration_min })),
    allowConsecutive: me.gym?.allow_consecutive ?? false,
    sports: me.sports.map((s) => s.sport),
  };
}

const focusLabel = (f: string | null) => FOCUSES.find((x) => x.value === f)?.label ?? f;

/** IA → plan: filtra ids desconocidos o no permitidos y normaliza. */
function aiToPlan(r: import("@/lib/ai/schemas/routine").AIRoutine, allowedIds: Set<string>): WeekPlan {
  return {
    sessions: r.sesiones.map((s) => ({
      weekday: s.dia,
      name: s.nombre,
      exercises: s.ejercicios
        .filter((e) => allowedIds.has(e.id))
        .map((e) => ({
          exerciseId: e.id,
          sets: e.series,
          repsMin: Math.min(e.reps_min, e.reps_max),
          repsMax: Math.max(e.reps_min, e.reps_max),
          restS: e.descanso_s,
          rir: e.rir,
          notes: e.notas,
        })),
    })),
  };
}

export interface GeneratedProgram {
  plan: WeekPlan;
  explanation: string;
  source: "ai" | "rules";
  changes: string[];
}

/** Historial para el próximo mesociclo: tests, mejores 1RM estimados y adherencia de las últimas semanas. */
async function trainingHistory(supabase: ServerClient, me: Me) {
  const since = new Date(Date.now() - 42 * 86_400_000).toISOString().slice(0, 10);
  const [tests, sets, workouts] = await Promise.all([
    supabase.from("fitness_tests").select("test, value, unit, log_date").eq("user_id", me.userId).order("log_date", { ascending: false }).limit(12),
    supabase.from("set_logs").select("exercise_id, kg, reps").eq("user_id", me.userId).gte("created_at", since).limit(1000),
    supabase.from("workout_sessions").select("feeling").eq("user_id", me.userId).gte("log_date", since).not("ended_at", "is", null),
  ]);
  const best = new Map<string, number>();
  for (const s of sets.data ?? []) {
    const e1 = Number(s.kg) * (1 + s.reps / 30);
    if (Number(s.kg) > 0 && e1 > (best.get(s.exercise_id) ?? 0)) best.set(s.exercise_id, e1);
  }
  const feelings = (workouts.data ?? []).map((w) => w.feeling).filter((f): f is number => f != null);
  return {
    tests: (tests.data ?? []).map((t) => `${t.test}: ${t.value} ${t.unit} (${t.log_date})`),
    mejores_1rm_estimados: [...best.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, v]) => `${LIBRARY_BY_ID[id]?.name ?? id}: ${Math.round(v)} kg`),
    sesiones_hechas_6_semanas: (workouts.data ?? []).length,
    sesiones_planificadas_6_semanas: (me.gym?.weekdays?.length ?? 0) * 6,
    sensacion_promedio: feelings.length ? Math.round((feelings.reduce((a, b) => a + b, 0) / feelings.length) * 10) / 10 : null,
  };
}

export async function generateWeekPlan(supabase: ServerClient, me: Me, opts: { extraInjuries?: string; recentPain?: string[] } = {}): Promise<GeneratedProgram> {
  const input = generatorInputFromMe(me, opts.extraInjuries);
  const ctx: PlacementContext = { gymDays: pickSessionDays(input.gymDays, input.allowConsecutive), events: input.events, allowConsecutive: input.allowConsecutive };
  const pool = allowedExercises(EXERCISE_LIBRARY, input);
  const allowedIds = new Set(pool.map((e) => e.id));
  const rulePlan = generateRulePlan(input, EXERCISE_LIBRARY);

  const out = await runAI<GeneratedProgram>({
    supabase,
    call: async () => {
      const days = ctx.gymDays.map((d) => ({
        dia: d,
        nombre_dia: WEEKDAY_LABELS[d].long,
        restriccion: dayRestriction(d, ctx) ?? "libre",
      }));
      const historial = await trainingHistory(supabase, me);
      const prompt = JSON.stringify({
        perfil: profileContext(me),
        historial,
        foco_principal: focusLabel(input.focusPrimary),
        foco_secundario: focusLabel(input.focusSecondary),
        experiencia: input.experience,
        minutos_por_sesion: input.minutes,
        ejercicios_por_sesion_aprox: exercisesPerSession(input.minutes),
        molestias: input.injuries || "ninguna",
        dolores_recientes: opts.recentPain ?? [],
        dias_de_gym: days,
        propuesta_base: rulePlan.sessions.map((s) => ({ dia: s.weekday, nombre: s.name, ejercicios: s.exercises.map((e) => e.exerciseId) })),
        biblioteca: pool.map((e) => ({ id: e.id, n: e.name, p: e.pattern, r: e.region, f: e.focus, i: e.impact, pesada: e.heavy_lower || undefined })),
      });
      const r = await getAI().generateJSON({
        system: ROUTINE_SYSTEM,
        prompt: `Armá la semana. Podés mejorar la propuesta base (ya cumple las reglas). Si hay historial, tenelo en cuenta: si la adherencia fue baja, simplificá; si la sensación fue baja, bajá volumen; si los tests mejoran, mantené el enfoque.\n${prompt}`,
        schema: aiRoutineSchema,
        temperature: 0.5,
      });
      const plan = aiToPlan(r, allowedIds);
      const { plan: fixed, changes } = fixPlan(plan, ctx, LIBRARY_BY_ID);
      if (validatePlan(fixed, ctx, LIBRARY_BY_ID).length || fixed.sessions.length === 0 || fixed.sessions.some((s) => s.exercises.length < 3)) {
        throw new Error("plan IA inválido");
      }
      return { plan: fixed, explanation: r.explicacion, source: "ai" as const, changes };
    },
    fallback: () => {
      const { plan, changes } = fixPlan(rulePlan, ctx, LIBRARY_BY_ID);
      return {
        plan,
        explanation: "Armé la semana con las reglas de siempre: lo pesado lejos de los partidos y prevención para tu deporte.",
        source: "rules" as const,
        changes,
      };
    },
  });
  return out.data;
}

/** Guarda el mesociclo (4 semanas) y archiva el anterior. */
export async function saveProgram(
  supabase: ServerClient,
  me: Me,
  gen: GeneratedProgram,
  opts: { source?: "ai" | "rules" | "copied"; copiedFrom?: string | null; name?: string } = {},
): Promise<{ ok: true; programId: string } | { ok: false; error: string }> {
  const mains = new Set(
    gen.plan.sessions.flatMap((s) =>
      s.exercises.filter((e) => ["squat", "hinge", "horizontal_push", "horizontal_pull", "vertical_pull", "vertical_push"].includes(LIBRARY_BY_ID[e.exerciseId]?.pattern ?? "")).map((e) => e.exerciseId),
    ),
  );
  const ctxP: PlacementContext = {
    gymDays: gen.plan.sessions.map((x) => x.weekday),
    events: me.schedule.map((x) => ({ weekday: x.weekday, sport: x.sport, kind: x.kind as "training" | "match", durationMin: x.duration_min })),
    allowConsecutive: true,
  };
  const lightWeekdays = new Set(gen.plan.sessions.map((x) => x.weekday).filter((d) => dayRestriction(d, ctxP) !== null));
  const weeks = expandMesocycle(gen.plan, { mainExerciseIds: mains, lightWeekdays });
  await supabase.from("programs").update({ status: "archived" }).eq("user_id", me.userId).eq("status", "active");
  const prog = await supabase
    .from("programs")
    .insert({
      user_id: me.userId,
      name: opts.name ?? `Mesociclo ${focusLabel(me.details.focus_primary) ?? ""}`.trim(),
      focus_primary: me.details.focus_primary,
      focus_secondary: me.details.focus_secondary,
      start_date: weekStart(me.today),
      weeks: weeks.length,
      status: "active",
      source: opts.source ?? (gen.source === "ai" ? "ai" : "rules"),
      copied_from: opts.copiedFrom ?? null,
      notes: gen.explanation,
    })
    .select("id")
    .single();
  if (prog.error || !prog.data) return { ok: false, error: "No pudimos guardar la rutina" };
  const programId = prog.data.id;

  for (const w of weeks) {
    const sess = await supabase
      .from("program_sessions")
      .insert(w.sessions.map((s) => ({ program_id: programId, user_id: me.userId, week: w.week, weekday: s.weekday, name: s.name, is_deload: w.isDeload })))
      .select("id, weekday");
    if (sess.error || !sess.data) return { ok: false, error: "No pudimos guardar las sesiones" };
    const rows = sess.data.flatMap((row) => {
      const s = w.sessions.find((x) => x.weekday === row.weekday)!;
      return s.exercises.map((e, i) => ({
        session_id: row.id,
        user_id: me.userId,
        exercise_id: e.exerciseId,
        position: i + 1,
        sets: e.sets,
        reps_min: e.repsMin,
        reps_max: e.repsMax,
        rest_s: e.restS,
        rir: e.rir,
        notes: e.notes ?? "",
      }));
    });
    if (rows.length) {
      const ins = await supabase.from("program_exercises").insert(rows);
      if (ins.error) return { ok: false, error: "No pudimos guardar los ejercicios" };
    }
  }
  return { ok: true, programId };
}
