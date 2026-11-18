import { describe, expect, it } from "vitest";
import { fallbackWeeklyGoals } from "./weekly";
import { violatesGuardrails } from "./guardrails";

describe("fallbackWeeklyGoals", () => {
  const base = { weekStart: "2026-11-16", daysLogged: 7, avgKcal: 2400, avgKcalTarget: 2500, proteinDays: 6, waterDays: 6, weightDeltaKg: -0.3, trendKg: 84, sessionsDone: 3, sessionsPlanned: 3, volumeKg: 20000, prs: [] };
  it("siempre 3 objetivos, priorizando lo flojo", () => {
    const g = fallbackWeeklyGoals({ ...base, proteinDays: 2, sessionsDone: 1 });
    expect(g).toHaveLength(3);
    expect(g[0]).toMatch(/proteína/);
    expect(g[1]).toMatch(/sesiones/);
  });
  it("semana perfecta → objetivos de mantenimiento", () => {
    const g = fallbackWeeklyGoals(base);
    expect(g).toHaveLength(3);
    for (const x of g) expect(violatesGuardrails(x)).toBe(false);
  });
});
