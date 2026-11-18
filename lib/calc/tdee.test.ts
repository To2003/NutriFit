import { describe, expect, it } from "vitest";
import { adaptiveTdee, clampChange, emaTrend } from "./tdee";

describe("emaTrend", () => {
  it("primer valor = primer pesaje; α = 0,1", () => {
    const t = emaTrend([
      { date: "2026-11-01", kg: 80 },
      { date: "2026-11-02", kg: 81 },
    ]);
    expect(t[0].trendKg).toBe(80);
    expect(t[1].trendKg).toBeCloseTo(80.1);
  });
  it("ordena por fecha", () => {
    const t = emaTrend([
      { date: "2026-11-02", kg: 81 },
      { date: "2026-11-01", kg: 80 },
    ]);
    expect(t.map((x) => x.date)).toEqual(["2026-11-01", "2026-11-02"]);
  });
  it("vacío → vacío", () => {
    expect(emaTrend([])).toEqual([]);
  });
});

describe("clampChange", () => {
  it("±200 máx", () => {
    expect(clampChange(2500, 2900, 200)).toBe(2700);
    expect(clampChange(2500, 2100, 200)).toBe(2300);
    expect(clampChange(2500, 2550, 200)).toBe(2550);
  });
});

describe("adaptiveTdee", () => {
  const days = (n: number, intake: number | null, complete = true) =>
    Array.from({ length: n }, (_, i) => ({
      date: `2026-11-${String(i + 1).padStart(2, "0")}`,
      intakeKcal: intake,
      complete,
    }));

  it("null si hay menos de 10 días completos en 14", () => {
    const d = [...days(9, 2200), ...days(5, null, false).map((x, i) => ({ ...x, date: `2026-11-${10 + i}` }))];
    expect(adaptiveTdee({ days: d, weights: [], previousTdee: 2600 })).toBeNull();
  });

  it("peso estable → gasto observado ≈ ingesta; nuevo = promedio", () => {
    const d = days(14, 2400);
    const w = d.map((x) => ({ date: x.date, kg: 80 }));
    const r = adaptiveTdee({ days: d, weights: w, previousTdee: 2600 })!;
    expect(r.observedTdee).toBeCloseTo(2400);
    expect(r.proposedTdee).toBe(2500);
  });

  it("bajando de peso → gasto observado > ingesta", () => {
    const d = days(14, 2200);
    const w = d.map((x, i) => ({ date: x.date, kg: 80 - i * 0.1 }));
    const r = adaptiveTdee({ days: d, weights: w, previousTdee: 2600 })!;
    expect(r.observedTdee).toBeGreaterThan(2200);
  });

  it("el cambio propuesto respeta ±200", () => {
    const d = days(14, 1800);
    const w = d.map((x) => ({ date: x.date, kg: 80 }));
    const r = adaptiveTdee({ days: d, weights: w, previousTdee: 2600 })!;
    expect(r.proposedTdee).toBe(2400);
  });

  it("sin pesajes suficientes → null", () => {
    const d = days(14, 2200);
    expect(adaptiveTdee({ days: d, weights: [{ date: "2026-11-01", kg: 80 }], previousTdee: 2600 })).toBeNull();
  });
});
