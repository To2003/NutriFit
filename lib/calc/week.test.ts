import { describe, expect, it } from "vitest";
import { activitiesForWeekday, weekTargets } from "./week";
import type { ScheduleEntry } from "./week";

const toto: ScheduleEntry[] = [
  { weekday: 2, sport: "volleyball", kind: "training", intensity: "moderate", durationMin: 120 },
  { weekday: 3, sport: "field_hockey", kind: "training", intensity: "moderate", durationMin: 90 },
  { weekday: 4, sport: "volleyball", kind: "training", intensity: "moderate", durationMin: 120 },
  { weekday: 5, sport: "field_hockey", kind: "training", intensity: "moderate", durationMin: 90 },
  { weekday: 6, sport: "volleyball", kind: "match", intensity: "hard", durationMin: 120 },
  { weekday: 7, sport: "field_hockey", kind: "match", intensity: "hard", durationMin: 70 },
];

describe("activitiesForWeekday", () => {
  it("junta agenda + gym del día", () => {
    const acts = activitiesForWeekday(2, toto, { weekdays: [1, 2], minutes: 60 });
    expect(acts).toHaveLength(2);
    expect(acts.find((a) => a.sport === "gym")?.durationMin).toBe(60);
  });
  it("día sin nada", () => {
    expect(activitiesForWeekday(1, toto, null)).toEqual([]);
  });
});

describe("weekTargets", () => {
  const base = {
    body: { sex: "male" as const, ageYears: 23, heightCm: 185, weightKg: 85 },
    goal: "lose_fat" as const,
    pace: "moderate" as const,
    lifestyle: "mixed" as const,
  };

  it("calcula los 7 días y agrupa por tipo", () => {
    const r = weekTargets({ ...base, schedule: toto, gym: null });
    expect(Object.keys(r.days)).toHaveLength(7);
    expect(r.days[1].dayType).toBe("rest");
    expect(r.days[6].dayType).toBe("match");
    expect(r.byType.rest?.weekdays).toEqual([1]);
    expect(r.byType.training?.weekdays).toEqual([2, 3, 4, 5]);
    expect(r.byType.match?.weekdays).toEqual([6, 7]);
    expect(r.byType.match!.carbsG).toBeGreaterThan(r.byType.rest!.carbsG);
    expect(r.byType.match!.kcal % 10).toBe(0);
  });

  it("si no hay días de un tipo → null", () => {
    const r = weekTargets({ ...base, schedule: [], gym: null });
    expect(r.byType.match).toBeNull();
    expect(r.byType.training).toBeNull();
    expect(r.byType.rest?.weekdays).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("los días de gym cuentan como entreno", () => {
    const r = weekTargets({ ...base, schedule: [], gym: { weekdays: [1, 3], minutes: 60 } });
    expect(r.byType.training?.weekdays).toEqual([1, 3]);
  });
});
