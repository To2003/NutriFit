import { dayTargets, type DayTargetsInput } from "./targets";
import type { Activity, DayTargets, DayType, Intensity, SessionKind, Sport } from "./types";

/** Día ISO: 1 = lunes … 7 = domingo. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export interface ScheduleEntry {
  weekday: number;
  sport: Sport;
  kind: SessionKind;
  intensity: Intensity;
  durationMin: number;
  startTime?: string | null;
}

export interface GymPlan {
  weekdays: number[];
  minutes: number;
  intensity?: Intensity;
}

export function activitiesForWeekday(weekday: number, schedule: ScheduleEntry[], gym: GymPlan | null): Activity[] {
  const acts: Activity[] = schedule
    .filter((s) => s.weekday === weekday)
    .map((s) => ({ sport: s.sport, kind: s.kind, intensity: s.intensity, durationMin: s.durationMin }));
  if (gym && gym.weekdays.includes(weekday) && gym.minutes > 0) {
    acts.push({ sport: "gym", kind: "training", intensity: gym.intensity ?? "moderate", durationMin: gym.minutes });
  }
  return acts;
}

export interface TypeSummary {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl: number;
  weekdays: number[];
}

export interface WeekTargets {
  days: Record<number, DayTargets>;
  byType: Record<DayType, TypeSummary | null>;
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function weekTargets(
  input: Omit<DayTargetsInput, "activities"> & { schedule: ScheduleEntry[]; gym: GymPlan | null },
): WeekTargets {
  const { schedule, gym, ...rest } = input;
  const days: Record<number, DayTargets> = {};
  for (const wd of WEEKDAYS) {
    days[wd] = dayTargets({ ...rest, activities: activitiesForWeekday(wd, schedule, gym) });
  }
  const byType: Record<DayType, TypeSummary | null> = { rest: null, training: null, match: null };
  for (const type of ["rest", "training", "match"] as const) {
    const wds = WEEKDAYS.filter((wd) => days[wd].dayType === type);
    if (wds.length === 0) continue;
    const ds = wds.map((wd) => days[wd]);
    byType[type] = {
      kcal: Math.round(avg(ds.map((d) => d.kcal)) / 10) * 10,
      proteinG: Math.round(avg(ds.map((d) => d.proteinG))),
      carbsG: Math.round(avg(ds.map((d) => d.carbsG))),
      fatG: Math.round(avg(ds.map((d) => d.fatG))),
      waterMl: Math.round(avg(ds.map((d) => d.waterMl)) / 50) * 50,
      weekdays: wds,
    };
  }
  return { days, byType };
}
