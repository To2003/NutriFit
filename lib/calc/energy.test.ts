import { describe, expect, it } from "vitest";
import { dayExpenditure, dayTypeOf, exerciseKcal, LIFESTYLE_FACTOR } from "./energy";
import { metFor } from "./mets";

describe("metFor", () => {
  it("valores de referencia del spec", () => {
    expect(metFor({ sport: "volleyball", kind: "training", intensity: "moderate" })).toBe(4);
    expect(metFor({ sport: "volleyball", kind: "training", intensity: "hard" })).toBe(6);
    expect(metFor({ sport: "volleyball", kind: "match", intensity: "moderate" })).toBe(6);
    expect(metFor({ sport: "beach_volleyball", kind: "training", intensity: "moderate" })).toBe(8);
    expect(metFor({ sport: "field_hockey", kind: "training", intensity: "moderate" })).toBe(6);
    expect(metFor({ sport: "field_hockey", kind: "match", intensity: "moderate" })).toBe(7.8);
    expect(metFor({ sport: "football", kind: "training", intensity: "moderate" })).toBe(7);
    expect(metFor({ sport: "basketball", kind: "training", intensity: "moderate" })).toBe(6.5);
    expect(metFor({ sport: "running", kind: "training", intensity: "moderate" })).toBe(8.3);
    expect(metFor({ sport: "cycling", kind: "training", intensity: "moderate" })).toBe(6.8);
    expect(metFor({ sport: "walking", kind: "training", intensity: "moderate" })).toBe(3.5);
    expect(metFor({ sport: "gym", kind: "training", intensity: "moderate" })).toBe(3.5);
    expect(metFor({ sport: "gym", kind: "training", intensity: "hard" })).toBe(6);
  });

  it("un partido nunca vale menos que el entreno de esa intensidad", () => {
    expect(metFor({ sport: "volleyball", kind: "match", intensity: "light" })).toBe(6);
  });
});

describe("exerciseKcal", () => {
  it("(MET − 1) × kg × horas", () => {
    // (6 - 1) * 80 * 1.5 = 600
    expect(exerciseKcal(6, 80, 90)).toBe(600);
  });
  it("0 minutos → 0", () => {
    expect(exerciseKcal(6, 80, 0)).toBe(0);
  });
  it("MET menor a 1 no resta", () => {
    expect(exerciseKcal(0.9, 80, 60)).toBe(0);
  });
  it("duración negativa no resta", () => {
    expect(exerciseKcal(6, 80, -30)).toBe(0);
  });
});

describe("dayExpenditure", () => {
  it("BMR × factor + ejercicio", () => {
    const bmr = 1800;
    const total = dayExpenditure({
      bmrKcal: bmr,
      lifestyle: "mixed",
      weightKg: 80,
      activities: [{ sport: "volleyball", kind: "training", intensity: "moderate", durationMin: 120 }],
    });
    // 1800*1.3 = 2340 ; (4-1)*80*2 = 480
    expect(total).toBe(2820);
  });

  it("sin actividades = BMR × factor", () => {
    expect(
      dayExpenditure({ bmrKcal: 1800, lifestyle: "sedentary", weightKg: 80, activities: [] }),
    ).toBe(1800 * LIFESTYLE_FACTOR.sedentary);
  });

  it("factores de estilo de vida", () => {
    expect(LIFESTYLE_FACTOR).toEqual({ sedentary: 1.2, mixed: 1.3, standing: 1.4, physical: 1.5 });
  });
});

describe("dayTypeOf", () => {
  it("partido gana", () => {
    expect(
      dayTypeOf([
        { sport: "gym", kind: "training", intensity: "hard", durationMin: 60 },
        { sport: "volleyball", kind: "match", intensity: "hard", durationMin: 90 },
      ]),
    ).toBe("match");
  });
  it("entreno", () => {
    expect(dayTypeOf([{ sport: "gym", kind: "training", intensity: "hard", durationMin: 60 }])).toBe("training");
  });
  it("vacío o 0 min → descanso", () => {
    expect(dayTypeOf([])).toBe("rest");
    expect(dayTypeOf([{ sport: "gym", kind: "training", intensity: "hard", durationMin: 0 }])).toBe("rest");
  });
  it("caminata sola no convierte el día en entreno", () => {
    expect(dayTypeOf([{ sport: "walking", kind: "training", intensity: "light", durationMin: 40 }])).toBe("rest");
  });
});
