import { describe, expect, it } from "vitest";
import { nextLoad, roundToPlate } from "./progression";
import { expandMesocycle } from "./mesocycle";
import type { WeekPlan } from "./types";

describe("nextLoad (doble progresión)", () => {
  const sets = (kg: number, reps: number[], rir: (number | null)[] = reps.map(() => 2)) => reps.map((r, i) => ({ kg, reps: r, rir: rir[i] }));

  it("tope del rango en todas las series con RIR ≥ 1 → sube (tren inferior +5)", () => {
    expect(nextLoad({ last: sets(100, [8, 8, 8]), repsMax: 8, region: "lower", loadType: "barbell" })).toEqual({ kg: 105, reason: "up" });
  });
  it("tren superior +2,5", () => {
    expect(nextLoad({ last: sets(60, [10, 10, 10]), repsMax: 10, region: "upper", loadType: "barbell" })).toEqual({ kg: 62.5, reason: "up" });
  });
  it("mancuernas → siguiente par (+2 kg)", () => {
    expect(nextLoad({ last: sets(14, [12, 12, 12]), repsMax: 12, region: "upper", loadType: "dumbbell" })).toEqual({ kg: 16, reason: "up" });
  });
  it("si una serie no llega al tope, se mantiene", () => {
    expect(nextLoad({ last: sets(100, [8, 8, 7]), repsMax: 8, region: "lower", loadType: "barbell" })).toEqual({ kg: 100, reason: "same" });
  });
  it("RIR 0 (al fallo) no sube", () => {
    expect(nextLoad({ last: sets(100, [8, 8, 8], [2, 1, 0]), repsMax: 8, region: "lower", loadType: "barbell" })).toEqual({ kg: 100, reason: "same" });
  });
  it("RIR sin cargar no bloquea la progresión", () => {
    expect(nextLoad({ last: sets(100, [8, 8], [null, null]), repsMax: 8, region: "lower", loadType: "barbell" }).reason).toBe("up");
  });
  it("peso corporal no sugiere kg", () => {
    expect(nextLoad({ last: sets(0, [12, 12]), repsMax: 12, region: "lower", loadType: "bodyweight" })).toEqual({ kg: 0, reason: "bodyweight" });
  });
  it("sin historial → null", () => {
    expect(nextLoad({ last: [], repsMax: 8, region: "lower", loadType: "barbell" })).toEqual({ kg: null, reason: "first_time" });
  });
  it("redondeo a discos de 1,25", () => {
    expect(roundToPlate(61.3)).toBe(61.25);
    expect(roundToPlate(62.6)).toBe(62.5);
  });
});

describe("expandMesocycle", () => {
  const week: WeekPlan = {
    sessions: [
      {
        weekday: 1,
        name: "A",
        exercises: [
          { exerciseId: "squat", sets: 3, repsMin: 5, repsMax: 8, restS: 150, rir: 3, notes: "" },
          { exerciseId: "curl", sets: 2, repsMin: 10, repsMax: 15, restS: 60, rir: 2, notes: "" },
        ],
      },
    ],
  };
  const r = expandMesocycle(week, { mainExerciseIds: new Set(["squat"]) });

  it("4 semanas: 3 de carga + 1 de descarga", () => {
    expect(r.map((w) => w.week)).toEqual([1, 2, 3, 4]);
    expect(r.map((w) => w.isDeload)).toEqual([false, false, false, true]);
  });
  it("RIR baja semana a semana (más exigente) con mínimo 1", () => {
    expect(r.map((w) => w.sessions[0].exercises[0].rir)).toEqual([3, 2, 1, 4]);
    expect(r.map((w) => w.sessions[0].exercises[1].rir)).toEqual([2, 1, 1, 4]);
  });
  it("la semana 3 suma una serie en los básicos", () => {
    expect(r.map((w) => w.sessions[0].exercises[0].sets)).toEqual([3, 3, 4, 2]);
    expect(r[2].sessions[0].exercises[1].sets).toBe(2);
  });
  it("descarga: ~60 % de las series, mínimo 1", () => {
    expect(r[3].sessions[0].exercises[1].sets).toBe(1);
  });
});
