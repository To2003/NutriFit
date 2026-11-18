import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import type { Me } from "@/lib/data/me";
import { addDays, isoWeekday, weekStart } from "@/lib/dates";
import { currentStreak, dailyStreakFlags, trainingWeekStreak } from "@/lib/calc/streaks";
import { buildTargetInputs, computeWeek } from "@/lib/data/targets";
import { unlockAchievements } from "./unlock";

export interface StreakView {
  logging: { current: number; best: number };
  water: { current: number; best: number };
  protein: { current: number; best: number };
  training_week: { current: number; best: number };
}

/** Recalcula rachas de los últimos 90 días, las guarda (para el perfil público) y desbloquea logros. */
export async function refreshStreaks(supabase: ServerClient, me: Me): Promise<StreakView> {
  const from = addDays(me.today, -90);
  const [foods, water, workouts, program] = await Promise.all([
    supabase.from("food_logs").select("log_date, food_log_items(protein_g)").eq("user_id", me.userId).gte("log_date", from),
    supabase.from("water_logs").select("log_date, ml").eq("user_id", me.userId).gte("log_date", from),
    supabase.from("workout_sessions").select("log_date").eq("user_id", me.userId).gte("log_date", from).not("ended_at", "is", null),
    supabase.from("programs").select("id, start_date, weeks").eq("user_id", me.userId).order("created_at", { ascending: false }).limit(3),
  ]);
  const inputs = buildTargetInputs({ details: me.details, weightKg: me.latestWeight?.kg, schedule: me.schedule, gym: me.gym, goals: me.goals });
  const week = inputs ? computeWeek(inputs) : null;

  const byDay = new Map<string, { meals: number; protein: number; water: number }>();
  const get = (d: string) => byDay.get(d) ?? (byDay.set(d, { meals: 0, protein: 0, water: 0 }), byDay.get(d)!);
  for (const f of foods.data ?? []) {
    const d = get(f.log_date);
    d.meals++;
    d.protein += (f.food_log_items ?? []).reduce((s, i) => s + Number(i.protein_g), 0);
  }
  for (const w of water.data ?? []) get(w.log_date).water += w.ml;

  const sets = { logging: new Set<string>(), water: new Set<string>(), protein: new Set<string>() };
  for (const [date, d] of byDay) {
    const t = week?.days[isoWeekday(date)];
    const f = dailyStreakFlags({ meals: d.meals, waterMl: d.water, waterTarget: t?.waterMl ?? 0, proteinG: d.protein, proteinTarget: t?.proteinG ?? 0 });
    if (f.logging) sets.logging.add(date);
    if (f.water) sets.water.add(date);
    if (f.protein) sets.protein.add(date);
  }

  // Racha semanal de entreno: sesiones planificadas por semana (días de gym) vs. hechas
  const planned = me.gym?.weekdays?.length ?? 0;
  const doneByWeek = new Map<string, number>();
  for (const w of workouts.data ?? []) doneByWeek.set(weekStart(w.log_date), (doneByWeek.get(weekStart(w.log_date)) ?? 0) + 1);
  const firstProgram = (program.data ?? []).map((p) => p.start_date).sort()[0];
  const weeks: { weekStart: string; planned: number; done: number }[] = [];
  if (firstProgram && planned > 0) {
    for (let ws = weekStart(firstProgram); ws <= weekStart(me.today); ws = addDays(ws, 7)) weeks.push({ weekStart: ws, planned, done: doneByWeek.get(ws) ?? 0 });
  }

  const view: StreakView = {
    logging: currentStreak(sets.logging, me.today),
    water: currentStreak(sets.water, me.today),
    protein: currentStreak(sets.protein, me.today),
    training_week: trainingWeekStreak(weeks, weekStart(me.today)),
  };

  await supabase.from("user_streaks").upsert(
    (Object.keys(view) as (keyof StreakView)[]).map((kind) => ({
      user_id: me.userId,
      kind,
      current: view[kind].current,
      best: view[kind].best,
      last_date: me.today,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "user_id,kind" },
  );

  const codes: string[] = [];
  if (byDay.size > 0 && [...byDay.values()].some((d) => d.meals > 0)) codes.push("first_log");
  if (view.logging.best >= 7) codes.push("streak_7");
  if (view.logging.best >= 30) codes.push("streak_30");
  if (view.water.best >= 7) codes.push("water_7");
  if (view.protein.best >= 7) codes.push("protein_7");
  if (view.training_week.best >= 1) codes.push("training_week");
  // 4 semanas seguidas con ≥5 días cargando
  const daysByWeek = new Map<string, number>();
  for (const [d, x] of byDay) if (x.meals > 0) daysByWeek.set(weekStart(d), (daysByWeek.get(weekStart(d)) ?? 0) + 1);
  let run = 0;
  for (let ws = weekStart(from); ws < weekStart(me.today); ws = addDays(ws, 7)) {
    run = (daysByWeek.get(ws) ?? 0) >= 5 ? run + 1 : 0;
    if (run >= 4) {
      codes.push("four_weeks_logging");
      break;
    }
  }
  await unlockAchievements(supabase, me.userId, codes);
  return view;
}
