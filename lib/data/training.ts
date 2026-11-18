import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import type { Me } from "@/lib/data/me";
import type { Tables } from "@/lib/supabase/database.types";
import { daysBetween, isoWeekday } from "@/lib/dates";
import { LIBRARY_BY_ID } from "@/lib/training/library-data";
import { cyclicDistance } from "@/lib/training/rules";

export type ProgramExerciseRow = Tables<"program_exercises">;
export type SessionWithExercises = Tables<"program_sessions"> & { program_exercises: ProgramExerciseRow[] };

export interface ActiveProgram {
  program: Tables<"programs">;
  currentWeek: number;
  finished: boolean;
  sessions: SessionWithExercises[];
}

export function programWeek(startDate: string, today: string): number {
  return Math.floor(daysBetween(startDate, today) / 7) + 1;
}

export async function getActiveProgram(supabase: ServerClient, me: Me): Promise<ActiveProgram | null> {
  const prog = await supabase
    .from("programs")
    .select("*")
    .eq("user_id", me.userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!prog.data) return null;
  const sessions = await supabase
    .from("program_sessions")
    .select("*, program_exercises(*)")
    .eq("program_id", prog.data.id)
    .order("week")
    .order("weekday");
  const week = programWeek(prog.data.start_date, me.today);
  return {
    program: prog.data,
    currentWeek: Math.min(Math.max(week, 1), prog.data.weeks),
    finished: week > prog.data.weeks,
    sessions: ((sessions.data ?? []) as SessionWithExercises[]).map((s) => ({
      ...s,
      program_exercises: [...s.program_exercises].sort((a, b) => a.position - b.position),
    })),
  };
}

/** Sesión de hoy (si hay) o la próxima de la semana actual. */
export function nextSession(ap: ActiveProgram, today: string): { session: SessionWithExercises; isToday: boolean; inDays: number } | null {
  if (ap.finished) return null;
  const wd = isoWeekday(today);
  const week = ap.sessions.filter((s) => s.week === ap.currentWeek);
  if (!week.length) return null;
  const sorted = [...week].sort((a, b) => cyclicDistance(wd, a.weekday) - cyclicDistance(wd, b.weekday));
  const s = sorted[0];
  const inDays = cyclicDistance(wd, s.weekday);
  // si la próxima cae en la semana siguiente, buscala ahí
  if (s.weekday < wd && inDays > 0) {
    const nextWeek = ap.sessions.find((x) => x.week === ap.currentWeek + 1 && x.weekday === s.weekday);
    if (nextWeek) return { session: nextWeek, isToday: false, inDays };
    return null;
  }
  return { session: s, isToday: inDays === 0, inDays };
}

/** Últimas series registradas por ejercicio (de la sesión más reciente que lo incluyó). */
export async function lastSetsByExercise(
  supabase: ServerClient,
  userId: string,
  exerciseIds: string[],
  excludeWorkoutId?: string,
): Promise<Record<string, { kg: number; reps: number; rir: number | null; set_number: number }[]>> {
  if (!exerciseIds.length) return {};
  let q = supabase
    .from("set_logs")
    .select("exercise_id, workout_session_id, set_number, kg, reps, rir, created_at")
    .eq("user_id", userId)
    .in("exercise_id", exerciseIds)
    .order("created_at", { ascending: false })
    .limit(400);
  if (excludeWorkoutId) q = q.neq("workout_session_id", excludeWorkoutId);
  const { data } = await q;
  const out: Record<string, { kg: number; reps: number; rir: number | null; set_number: number }[]> = {};
  const lastWorkout: Record<string, string> = {};
  for (const r of data ?? []) {
    lastWorkout[r.exercise_id] ??= r.workout_session_id;
    if (lastWorkout[r.exercise_id] !== r.workout_session_id) continue;
    (out[r.exercise_id] ??= []).push({ kg: Number(r.kg), reps: r.reps, rir: r.rir, set_number: r.set_number });
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.set_number - b.set_number);
  return out;
}

export function exerciseName(id: string): string {
  return LIBRARY_BY_ID[id]?.name ?? id;
}
