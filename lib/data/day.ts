import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import type { Me } from "@/lib/data/me";
import { isoWeekday } from "@/lib/dates";
import { buildTargetInputs, parseStored, targetsForDay, type TargetInputs } from "@/lib/data/targets";
import type { Activity, DayTargets, Intensity, SessionKind, Sport } from "@/lib/calc/types";
import type { Tables } from "@/lib/supabase/database.types";

export interface MealEntry {
  id: string;
  meal: string;
  origin: string;
  photo_path: string | null;
  input_text: string | null;
  created_at: string;
  items: Tables<"food_log_items">[];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface PlannedActivity {
  scheduleId: string;
  sport: Sport;
  kind: SessionKind;
  start_time: string | null;
  duration_min: number;
  intensity: Intensity;
  status: "pending" | "done" | "skipped";
  log: Tables<"activity_logs"> | null;
}

export interface DaySummary {
  date: string;
  weekday: number;
  targets: DayTargets | null;
  totals: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
  waterMl: number;
  meals: MealEntry[];
  water: Tables<"water_logs">[];
  planned: PlannedActivity[];
  extraActivities: Tables<"activity_logs">[];
  workouts: Tables<"workout_sessions">[];
  gymPlanned: boolean;
  weightKg: number | null;
  inputs: TargetInputs | null;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const r1 = (n: number) => Math.round(n * 10) / 10;

export async function loadDay(supabase: ServerClient, me: Me, date: string): Promise<DaySummary> {
  const uid = me.userId;
  const [foods, water, acts, weight, workouts] = await Promise.all([
    supabase.from("food_logs").select("*, food_log_items(*)").eq("user_id", uid).eq("log_date", date).order("created_at"),
    supabase.from("water_logs").select("*").eq("user_id", uid).eq("log_date", date).order("logged_at"),
    supabase.from("activity_logs").select("*").eq("user_id", uid).eq("log_date", date).order("created_at"),
    supabase.from("weight_logs").select("kg").eq("user_id", uid).eq("log_date", date).maybeSingle(),
    supabase.from("workout_sessions").select("*").eq("user_id", uid).eq("log_date", date).order("started_at"),
  ]);

  const meals: MealEntry[] = (foods.data ?? []).map((f) => {
    const items = (f.food_log_items ?? []) as Tables<"food_log_items">[];
    return {
      id: f.id,
      meal: f.meal,
      origin: f.origin,
      photo_path: f.photo_path,
      input_text: f.input_text,
      created_at: f.created_at,
      items,
      kcal: Math.round(sum(items.map((i) => Number(i.kcal)))),
      protein_g: r1(sum(items.map((i) => Number(i.protein_g)))),
      carbs_g: r1(sum(items.map((i) => Number(i.carbs_g)))),
      fat_g: r1(sum(items.map((i) => Number(i.fat_g)))),
    };
  });

  const weekday = isoWeekday(date);
  const logs = acts.data ?? [];
  const planned: PlannedActivity[] = me.schedule
    .filter((s) => s.weekday === weekday)
    .map((s) => {
      const log = logs.find((l) => l.schedule_id === s.id) ?? null;
      return {
        scheduleId: s.id,
        sport: s.sport as Sport,
        kind: s.kind as SessionKind,
        start_time: s.start_time,
        duration_min: s.duration_min,
        intensity: s.intensity as Intensity,
        status: log ? (log.status as "done" | "skipped") : "pending",
        log,
      };
    });
  const extraActivities = logs.filter((l) => !l.schedule_id || !planned.some((p) => p.scheduleId === l.schedule_id));
  const gymPlanned = Boolean(me.gym?.weekdays?.includes(weekday));
  const ws = workouts.data ?? [];

  // Actividades efectivas del día: lo registrado manda; lo pendiente cuenta como planificado.
  const effective: Activity[] = [];
  for (const p of planned) {
    if (p.status === "skipped") continue;
    const src = p.log && p.status === "done" ? p.log : null;
    effective.push({
      sport: p.sport,
      kind: (src?.kind as SessionKind) ?? p.kind,
      intensity: (src?.intensity as Intensity) ?? p.intensity,
      durationMin: src?.duration_min ?? p.duration_min,
    });
  }
  for (const l of extraActivities) {
    if (l.status === "done")
      effective.push({ sport: l.sport as Sport, kind: l.kind as SessionKind, intensity: l.intensity as Intensity, durationMin: l.duration_min });
  }
  const gymDone = ws.filter((w) => w.ended_at);
  if (gymDone.length) {
    for (const w of gymDone) effective.push({ sport: "gym", kind: "training", intensity: "hard", durationMin: w.duration_min ?? me.gym?.minutes ?? 60 });
  } else if (gymPlanned) {
    effective.push({ sport: "gym", kind: "training", intensity: "moderate", durationMin: me.gym?.minutes ?? 60 });
  }

  const inputs = buildTargetInputs({ details: me.details, weightKg: me.latestWeight?.kg, schedule: me.schedule, gym: me.gym, goals: me.goals });
  const targets = inputs
    ? targetsForDay({
        inputs: { ...inputs, gym: null, schedule: [] },
        weekday,
        loggedActivities: effective,
        stored: parseStored(me.goals?.targets),
        manualOverride: Boolean(me.goals?.manual_override),
      })
    : null;

  return {
    date,
    weekday,
    targets,
    totals: {
      kcal: sum(meals.map((m) => m.kcal)),
      protein_g: r1(sum(meals.map((m) => m.protein_g))),
      carbs_g: r1(sum(meals.map((m) => m.carbs_g))),
      fat_g: r1(sum(meals.map((m) => m.fat_g))),
    },
    waterMl: sum((water.data ?? []).map((w) => w.ml)),
    meals,
    water: water.data ?? [],
    planned,
    extraActivities,
    workouts: ws,
    gymPlanned,
    weightKg: weight.data ? Number(weight.data.kg) : null,
    inputs,
  };
}
