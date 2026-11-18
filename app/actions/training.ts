"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUserId, loadMe } from "@/lib/data/me";
import { generateWeekPlan, saveProgram } from "@/lib/training/generate";
import { LIBRARY_BY_ID } from "@/lib/training/library-data";
import { painSafeReplacement, loadsZone, PAIN_ZONES } from "@/lib/training/pain";
import { best1RM, sessionVolume } from "@/lib/calc/strength";
import { workoutFeedback } from "@/lib/agent/workout";
import { unlockAchievements } from "@/lib/gamification/unlock";
import { lastSetsByExercise } from "@/lib/data/training";
import type { WeekPlan } from "@/lib/training/types";

type Fail = { ok: false; error: string };

async function ctx() {
  const userId = await getUserId();
  if (!userId) return null;
  const supabase = await createClient();
  return { userId, supabase };
}

export async function generateProgramAction(): Promise<{ ok: true; source: "ai" | "rules"; explanation: string; changes: string[] } | Fail> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Se cortó la sesión" };
  const me = await loadMe(c.supabase, c.userId);
  if (!me) return { ok: false, error: "No encontramos tu perfil" };
  if (!me.gym?.weekdays?.length) return { ok: false, error: "Elegí tus días de gym en Perfil → Gimnasio" };
  const pains = await c.supabase.from("pain_reports").select("zone, intensity").eq("user_id", c.userId).eq("resolved", false).limit(5);
  const gen = await generateWeekPlan(c.supabase, me, {
    extraInjuries: (pains.data ?? []).map((p) => PAIN_ZONES.find((z) => z.value === p.zone)?.label ?? p.zone).join(", "),
    recentPain: (pains.data ?? []).map((p) => `${p.zone} ${p.intensity}/10`),
  });
  const saved = await saveProgram(c.supabase, me, gen);
  if (!saved.ok) return saved;
  revalidatePath("/", "layout");
  return { ok: true, source: gen.source, explanation: gen.explanation, changes: gen.changes };
}

export async function swapExerciseAction(input: { programId: string; fromId: string; toId: string }): Promise<{ ok: true } | Fail> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Se cortó la sesión" };
  const from = LIBRARY_BY_ID[input.fromId];
  const to = LIBRARY_BY_ID[input.toId];
  if (!from || !to) return { ok: false, error: "Ejercicio inválido" };
  if (!from.alternatives.includes(to.id) && from.pattern !== to.pattern) return { ok: false, error: "Solo podés cambiar por uno del mismo patrón" };
  const sessions = await c.supabase.from("program_sessions").select("id").eq("program_id", input.programId).eq("user_id", c.userId);
  const ids = (sessions.data ?? []).map((s) => s.id);
  if (!ids.length) return { ok: false, error: "Rutina no encontrada" };
  const r = await c.supabase.from("program_exercises").update({ exercise_id: to.id }).in("session_id", ids).eq("exercise_id", from.id);
  if (r.error) return { ok: false, error: "No pudimos cambiar el ejercicio" };
  revalidatePath("/entreno", "layout");
  return { ok: true };
}

export async function startWorkoutAction(programSessionId: string | null): Promise<{ ok: true; workoutId: string } | Fail> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Se cortó la sesión" };
  const me = await loadMe(c.supabase, c.userId);
  if (!me) return { ok: false, error: "No encontramos tu perfil" };
  // reusar una sesión abierta de hoy
  const open = await c.supabase
    .from("workout_sessions")
    .select("id")
    .eq("user_id", c.userId)
    .eq("log_date", me.today)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open.data) return { ok: true, workoutId: open.data.id };
  const r = await c.supabase
    .from("workout_sessions")
    .insert({ user_id: c.userId, program_session_id: programSessionId, log_date: me.today })
    .select("id")
    .single();
  if (r.error || !r.data) return { ok: false, error: "No pudimos arrancar la sesión" };
  return { ok: true, workoutId: r.data.id };
}

const setSchema = z.object({
  workoutId: z.string().uuid(),
  exerciseId: z.string(),
  setNumber: z.number().int().min(1).max(20),
  kg: z.number().min(0).max(600),
  reps: z.number().int().min(0).max(200),
  rir: z.number().int().min(0).max(5).nullable(),
});

export async function logSetAction(input: z.infer<typeof setSchema>): Promise<{ ok: true } | Fail> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Se cortó la sesión" };
  const p = setSchema.safeParse(input);
  if (!p.success || !LIBRARY_BY_ID[input.exerciseId]) return { ok: false, error: "Serie inválida" };
  const d = p.data;
  await c.supabase.from("set_logs").delete().eq("workout_session_id", d.workoutId).eq("exercise_id", d.exerciseId).eq("set_number", d.setNumber).eq("user_id", c.userId);
  const r = await c.supabase.from("set_logs").insert({
    workout_session_id: d.workoutId,
    user_id: c.userId,
    exercise_id: d.exerciseId,
    set_number: d.setNumber,
    kg: d.kg,
    reps: d.reps,
    rir: d.rir,
  });
  if (r.error) return { ok: false, error: "No pudimos guardar la serie" };
  return { ok: true };
}

export async function deleteSetAction(input: { workoutId: string; exerciseId: string; setNumber: number }): Promise<{ ok: true } | Fail> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Se cortó la sesión" };
  await c.supabase
    .from("set_logs")
    .delete()
    .eq("workout_session_id", input.workoutId)
    .eq("exercise_id", input.exerciseId)
    .eq("set_number", input.setNumber)
    .eq("user_id", c.userId);
  return { ok: true };
}

export async function reportPainAction(input: {
  workoutId: string | null;
  exerciseId: string | null;
  zone: string;
  intensity: number;
  notes?: string;
}): Promise<{ ok: true; message: string; adjusted: number } | Fail> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Se cortó la sesión" };
  if (!PAIN_ZONES.some((z) => z.value === input.zone) || input.intensity < 1 || input.intensity > 10) return { ok: false, error: "Datos inválidos" };
  const me = await loadMe(c.supabase, c.userId);
  if (!me) return { ok: false, error: "No encontramos tu perfil" };
  await c.supabase.from("pain_reports").insert({
    user_id: c.userId,
    workout_session_id: input.workoutId,
    exercise_id: input.exerciseId && LIBRARY_BY_ID[input.exerciseId] ? input.exerciseId : null,
    log_date: me.today,
    zone: input.zone,
    intensity: Math.round(input.intensity),
    notes: (input.notes ?? "").slice(0, 300),
  });

  // Ajusta las sesiones que faltan del programa activo: reemplaza o quita lo que carga la zona.
  let adjusted = 0;
  const prog = await c.supabase.from("programs").select("id, start_date").eq("user_id", c.userId).eq("status", "active").maybeSingle();
  if (prog.data && input.zone !== "other") {
    const sess = await c.supabase.from("program_sessions").select("id, week, weekday, program_exercises(id, exercise_id)").eq("program_id", prog.data.id);
    const { programWeek } = await import("@/lib/data/training");
    const curWeek = programWeek(prog.data.start_date, me.today);
    for (const s of sess.data ?? []) {
      if (s.week < curWeek) continue;
      for (const pe of s.program_exercises ?? []) {
        const info = LIBRARY_BY_ID[pe.exercise_id];
        if (!info || !loadsZone(info, input.zone)) continue;
        // intensidad baja (≤3) solo afecta al ejercicio que molestó
        if (input.intensity <= 3 && pe.exercise_id !== input.exerciseId) continue;
        const rep = painSafeReplacement(info, input.zone, LIBRARY_BY_ID);
        if (rep) await c.supabase.from("program_exercises").update({ exercise_id: rep, notes: "Cambiado por molestia reportada." }).eq("id", pe.id);
        else await c.supabase.from("program_exercises").delete().eq("id", pe.id);
        adjusted++;
      }
    }
  }
  const label = PAIN_ZONES.find((z) => z.value === input.zone)?.label.toLowerCase();
  const message =
    input.intensity >= 7
      ? `Molestia fuerte en ${label}: pará con lo que la cargue y consultá a un médico o kinesiólogo. No es para hacerse el guapo.`
      : `Anotado lo de ${label}. ${adjusted ? `Ajusté ${adjusted} ejercicio${adjusted === 1 ? "" : "s"} que la cargaban. ` : ""}Si sigue o empeora, consultalo con un profesional.`;
  await c.supabase.from("agent_messages").insert({ user_id: c.userId, kind: "pain", for_date: me.today, content: { text: message, zone: input.zone, intensity: input.intensity }, source: "fallback" });
  revalidatePath("/entreno", "layout");
  return { ok: true, message, adjusted };
}

export async function finishWorkoutAction(input: {
  workoutId: string;
  feeling: number | null;
  notes?: string;
}): Promise<{ ok: true; summary: { durationMin: number; volumeKg: number; prs: { exercise: string; e1rm: number }[]; feedback: string } } | Fail> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Se cortó la sesión" };
  const ws = await c.supabase.from("workout_sessions").select("*, program_sessions(name, is_deload)").eq("id", input.workoutId).eq("user_id", c.userId).single();
  if (ws.error || !ws.data) return { ok: false, error: "Sesión no encontrada" };
  const sets = await c.supabase.from("set_logs").select("exercise_id, kg, reps, rir").eq("workout_session_id", input.workoutId);
  const rows = (sets.data ?? []).map((s) => ({ exerciseId: s.exercise_id, kg: Number(s.kg), reps: s.reps }));
  const volume = sessionVolume(rows);
  const durationMin = Math.max(1, Math.round((Date.now() - new Date(ws.data.started_at).getTime()) / 60000));

  // PRs: mejor 1RM estimado de hoy vs. historial previo
  const ids = [...new Set(rows.map((r) => r.exerciseId))];
  const prs: { exercise: string; e1rm: number }[] = [];
  if (ids.length) {
    const hist = await c.supabase.from("set_logs").select("exercise_id, kg, reps").eq("user_id", c.userId).in("exercise_id", ids).neq("workout_session_id", input.workoutId);
    for (const id of ids) {
      const info = LIBRARY_BY_ID[id];
      if (!info || info.load_type === "bodyweight" || info.load_type === "band" || info.pattern === "plyometric") continue;
      const today = best1RM(rows.filter((r) => r.exerciseId === id));
      const prev = best1RM((hist.data ?? []).filter((h) => h.exercise_id === id).map((h) => ({ kg: Number(h.kg), reps: h.reps })));
      if (prev > 0 && today > prev * 1.005) prs.push({ exercise: info.name, e1rm: Math.round(today * 10) / 10 });
    }
  }

  await c.supabase
    .from("workout_sessions")
    .update({
      ended_at: new Date().toISOString(),
      duration_min: Math.min(durationMin, 300),
      volume_kg: Math.round(volume),
      feeling: input.feeling,
      notes: (input.notes ?? "").slice(0, 500),
    })
    .eq("id", input.workoutId);

  const pains = await c.supabase.from("pain_reports").select("zone, intensity").eq("workout_session_id", input.workoutId);
  const ps = ws.data.program_sessions as { name: string; is_deload: boolean } | null;
  const feedback = await workoutFeedback(c.supabase, c.userId, ws.data.log_date, {
    sessionName: ps?.name ?? "Sesión libre",
    durationMin,
    volumeKg: volume,
    feeling: input.feeling,
    prs,
    pain: (pains.data ?? []).map((p) => ({ zone: PAIN_ZONES.find((z) => z.value === p.zone)?.label ?? p.zone, intensity: p.intensity })),
    isDeload: Boolean(ps?.is_deload),
  }, input.workoutId);
  await unlockAchievements(c.supabase, c.userId, ["first_workout", ...(prs.length ? ["first_pr"] : [])]);
  revalidatePath("/", "layout");
  return { ok: true, summary: { durationMin, volumeKg: volume, prs, feedback } };
}

export async function discardWorkoutAction(workoutId: string): Promise<{ ok: true }> {
  const c = await ctx();
  if (c) await c.supabase.from("workout_sessions").delete().eq("id", workoutId).eq("user_id", c.userId).is("ended_at", null);
  revalidatePath("/entreno", "layout");
  return { ok: true };
}

export async function previousSetsAction(workoutId: string, exerciseIds: string[]) {
  const c = await ctx();
  if (!c) return {};
  return lastSetsByExercise(c.supabase, c.userId, exerciseIds.slice(0, 20), workoutId);
}

/** Copia la rutina activa de otro perfil (si tiene entrenos visibles: lo garantiza RLS). */
export async function copyProgramAction(ownerId: string): Promise<{ ok: true } | Fail> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Se cortó la sesión" };
  if (ownerId === c.userId) return { ok: false, error: "Ya es tu rutina 😅" };
  const prog = await c.supabase.from("programs").select("id, name").eq("user_id", ownerId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!prog.data) return { ok: false, error: "No podés ver la rutina de este perfil" };
  const sess = await c.supabase.from("program_sessions").select("weekday, name, program_exercises(exercise_id, position, sets, reps_min, reps_max, rest_s, rir, notes)").eq("program_id", prog.data.id).eq("week", 1);
  if (!sess.data?.length) return { ok: false, error: "Esa rutina está vacía" };
  const me = await loadMe(c.supabase, c.userId);
  if (!me) return { ok: false, error: "No encontramos tu perfil" };
  const { fixPlan } = await import("@/lib/training/rules");
  const { pickSessionDays } = await import("@/lib/training/templates");
  const myDays = pickSessionDays(me.gym?.weekdays?.length ? me.gym.weekdays : sess.data.map((s) => s.weekday), me.gym?.allow_consecutive ?? false);
  // Se adapta a TUS días de gym y TU agenda (las reglas corrigen lo que haga falta)
  const plan: WeekPlan = {
    sessions: [...sess.data]
      .sort((a, b) => a.weekday - b.weekday)
      .slice(0, myDays.length)
      .map((s, i) => ({
        weekday: myDays[i],
        name: s.name.replace(/ · descarga$/, ""),
        exercises: [...(s.program_exercises ?? [])]
          .sort((a, b) => a.position - b.position)
          .map((e) => ({ exerciseId: e.exercise_id, sets: e.sets, repsMin: e.reps_min, repsMax: e.reps_max, restS: e.rest_s, rir: e.rir, notes: e.notes })),
      })),
  };
  const ctxP = {
    gymDays: myDays,
    events: me.schedule.map((s) => ({ weekday: s.weekday, sport: s.sport, kind: s.kind as "training" | "match", durationMin: s.duration_min })),
    allowConsecutive: me.gym?.allow_consecutive ?? false,
  };
  const fixed = fixPlan(plan, ctxP, LIBRARY_BY_ID);
  const saved = await saveProgram(
    c.supabase,
    me,
    { plan: fixed.plan, explanation: `Copiada de otro perfil y adaptada a tu agenda.`, source: "rules", changes: fixed.changes },
    { source: "copied", copiedFrom: prog.data.id, name: `${prog.data.name} (copia)` },
  );
  if (!saved.ok) return saved;
  revalidatePath("/", "layout");
  return { ok: true };
}
