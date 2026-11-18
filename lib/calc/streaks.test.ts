import { describe, expect, it } from "vitest";
import { currentStreak, dailyStreakFlags, trainingWeekStreak } from "./streaks";

describe("currentStreak", () => {
  const today = "2026-11-20";
  it("cuenta días consecutivos hasta hoy", () => {
    expect(currentStreak(new Set(["2026-11-18", "2026-11-19", "2026-11-20"]), today)).toEqual({ current: 3, best: 3 });
  });
  it("si hoy todavía no se cumplió, la racha sigue viva desde ayer", () => {
    expect(currentStreak(new Set(["2026-11-18", "2026-11-19"]), today).current).toBe(2);
  });
  it("un hueco corta la racha", () => {
    expect(currentStreak(new Set(["2026-11-15", "2026-11-16", "2026-11-19", "2026-11-20"]), today)).toEqual({ current: 2, best: 2 });
  });
  it("mejor racha histórica", () => {
    const days = new Set(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-20"]);
    expect(currentStreak(days, today)).toEqual({ current: 1, best: 4 });
  });
  it("vacío", () => {
    expect(currentStreak(new Set(), today)).toEqual({ current: 0, best: 0 });
  });
});

describe("dailyStreakFlags", () => {
  it("registro ≥ 3 comidas, agua cumplida, proteína ≥ 90 %", () => {
    expect(dailyStreakFlags({ meals: 3, waterMl: 3000, waterTarget: 3000, proteinG: 153, proteinTarget: 170 })).toEqual({
      logging: true,
      water: true,
      protein: true,
    });
    expect(dailyStreakFlags({ meals: 2, waterMl: 2999, waterTarget: 3000, proteinG: 152, proteinTarget: 170 })).toEqual({
      logging: false,
      water: false,
      protein: false,
    });
  });
  it("sin objetivo no hay racha", () => {
    expect(dailyStreakFlags({ meals: 3, waterMl: 0, waterTarget: 0, proteinG: 0, proteinTarget: 0 }).water).toBe(false);
  });
});

describe("trainingWeekStreak", () => {
  it("semanas consecutivas cumpliendo las sesiones planificadas", () => {
    const weeks = [
      { weekStart: "2026-11-02", planned: 3, done: 3 },
      { weekStart: "2026-11-09", planned: 3, done: 3 },
      { weekStart: "2026-11-16", planned: 3, done: 1 }, // semana en curso, todavía no cuenta en contra
    ];
    expect(trainingWeekStreak(weeks, "2026-11-16")).toEqual({ current: 2, best: 2 });
  });
  it("una semana incumplida corta", () => {
    const weeks = [
      { weekStart: "2026-11-02", planned: 3, done: 3 },
      { weekStart: "2026-11-09", planned: 3, done: 2 },
    ];
    expect(trainingWeekStreak(weeks, "2026-11-16")).toEqual({ current: 0, best: 1 });
  });
  it("semana sin plan no corta ni suma", () => {
    const weeks = [
      { weekStart: "2026-11-02", planned: 3, done: 3 },
      { weekStart: "2026-11-09", planned: 0, done: 0 },
    ];
    expect(trainingWeekStreak(weeks, "2026-11-16").current).toBe(1);
  });
});
