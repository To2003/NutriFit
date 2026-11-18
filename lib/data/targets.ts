import { ageFromBirthdate } from "@/lib/calc/bmr";
import { dayTargets } from "@/lib/calc/targets";
import { activitiesForWeekday, weekTargets, type ScheduleEntry, type WeekTargets } from "@/lib/calc/week";
import type { Activity, BodyData, DayTargets, DayType, Goal, Intensity, Lifestyle, Pace, Sex, Sport } from "@/lib/calc/types";
import type { Json, Tables } from "@/lib/supabase/database.types";

export interface TargetInputs {
  body: BodyData;
  goal: Goal;
  pace: Pace;
  lifestyle: Lifestyle;
  schedule: ScheduleEntry[];
  gym: { weekdays: number[]; minutes: number } | null;
  expenditureOffsetKcal: number;
}

type DetailsLike = Pick<Tables<"profile_details">, "birthdate" | "sex" | "height_cm" | "goal" | "pace" | "lifestyle">;

/** Arma los inputs del motor desde la base. Devuelve null si faltan datos del onboarding. */
export function buildTargetInputs(args: {
  details: DetailsLike;
  weightKg: number | null | undefined;
  schedule: Pick<Tables<"weekly_schedule">, "weekday" | "sport" | "kind" | "intensity" | "duration_min" | "start_time">[];
  gym: Pick<Tables<"gym_preferences">, "weekdays" | "minutes"> | null;
  goals?: Pick<Tables<"user_goals">, "expenditure_offset_kcal"> | null;
  today?: Date;
}): TargetInputs | null {
  const { details, weightKg } = args;
  if (!details.birthdate || !details.sex || !details.height_cm || !weightKg || !details.goal || !details.lifestyle) return null;
  return {
    body: {
      sex: details.sex as Sex,
      ageYears: ageFromBirthdate(details.birthdate, args.today),
      heightCm: Number(details.height_cm),
      weightKg: Number(weightKg),
    },
    goal: details.goal as Goal,
    pace: (details.pace as Pace) ?? "moderate",
    lifestyle: details.lifestyle as Lifestyle,
    schedule: args.schedule.map((s) => ({
      weekday: s.weekday,
      sport: s.sport as Sport,
      kind: s.kind as "training" | "match",
      intensity: s.intensity as Intensity,
      durationMin: s.duration_min,
      startTime: s.start_time,
    })),
    gym: args.gym && args.gym.weekdays.length > 0 ? { weekdays: args.gym.weekdays, minutes: args.gym.minutes } : null,
    expenditureOffsetKcal: args.goals?.expenditure_offset_kcal ?? 0,
  };
}

export function computeWeek(inputs: TargetInputs): WeekTargets {
  return weekTargets({
    body: inputs.body,
    goal: inputs.goal,
    pace: inputs.pace,
    lifestyle: inputs.lifestyle,
    schedule: inputs.schedule,
    gym: inputs.gym,
    expenditureOffsetKcal: inputs.expenditureOffsetKcal,
  });
}

export interface StoredTypeTargets {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_ml: number;
  weekdays: number[];
}
export type StoredTargets = Record<DayType, StoredTypeTargets | null>;

export function weekToStored(week: WeekTargets): StoredTargets {
  const out = { rest: null, training: null, match: null } as StoredTargets;
  for (const t of ["rest", "training", "match"] as const) {
    const s = week.byType[t];
    out[t] = s
      ? { kcal: s.kcal, protein_g: s.proteinG, carbs_g: s.carbsG, fat_g: s.fatG, water_ml: s.waterMl, weekdays: s.weekdays }
      : null;
  }
  return out;
}

export function parseStored(json: Json | null | undefined): StoredTargets | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  return json as unknown as StoredTargets;
}

/**
 * Objetivo de un día concreto. Usa las actividades registradas si existen; si no, la agenda.
 * Si el usuario fijó objetivos a mano, se respetan para ese tipo de día.
 */
export function targetsForDay(args: {
  inputs: TargetInputs;
  weekday: number;
  loggedActivities?: Activity[] | null;
  stored?: StoredTargets | null;
  manualOverride?: boolean;
}): DayTargets {
  const planned = activitiesForWeekday(args.weekday, args.inputs.schedule, args.inputs.gym);
  const activities = args.loggedActivities && args.loggedActivities.length > 0 ? args.loggedActivities : planned;
  const t = dayTargets({
    body: args.inputs.body,
    goal: args.inputs.goal,
    pace: args.inputs.pace,
    lifestyle: args.inputs.lifestyle,
    activities,
    expenditureOffsetKcal: args.inputs.expenditureOffsetKcal,
  });
  const manual = args.manualOverride ? args.stored?.[t.dayType] : null;
  if (manual) {
    return { ...t, kcal: manual.kcal, proteinG: manual.protein_g, carbsG: manual.carbs_g, fatG: manual.fat_g };
  }
  return t;
}
