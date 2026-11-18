import { describe, expect, it } from "vitest";
import { calorieTarget, dayTargets, macroTargets, PACE_PCT_PER_WEEK, waterTarget } from "./targets";

describe("calorieTarget", () => {
  const base = { bmrKcal: 1805, sex: "male" as const, weightKg: 80 };

  it("bajar grasa moderado: déficit = ritmo × 7700 / 7", () => {
    // 80 kg × 0,625 % = 0,5 kg/sem → 550 kcal/día
    const r = calorieTarget({ ...base, expenditureKcal: 2820, goal: "lose_fat", pace: "moderate" });
    expect(r.kcal).toBe(2270);
    expect(r.notes).toEqual([]);
  });

  it("tope: déficit ≤ 25 % del gasto", () => {
    // rápido 0,875 % → 0,7 kg/sem → 770 kcal; tope 25 % de 3600 = 900 → no aplica
    expect(calorieTarget({ ...base, expenditureKcal: 3600, goal: "lose_fat", pace: "fast" }).kcal).toBe(2830);
    // gasto 2400 → tope 600 → 1800... pero el piso (BMR 1805) manda
    const r = calorieTarget({ ...base, expenditureKcal: 2400, goal: "lose_fat", pace: "fast" });
    expect(r.kcal).toBe(1810);
    expect(r.notes).toContain("deficit_capped");
    expect(r.notes).toContain("kcal_floor");
  });

  it("tope sin piso", () => {
    const r = calorieTarget({ ...base, bmrKcal: 1500, expenditureKcal: 2800, goal: "lose_fat", pace: "fast" });
    // tope 700 < 770 → 2100
    expect(r.kcal).toBe(2100);
    expect(r.notes).toEqual(["deficit_capped"]);
  });

  it("piso hombres: max(BMR, 1500)", () => {
    const r = calorieTarget({ bmrKcal: 1400, sex: "male", weightKg: 60, expenditureKcal: 1700, goal: "lose_fat", pace: "fast" });
    expect(r.kcal).toBe(1500);
    expect(r.notes).toContain("kcal_floor");
  });

  it("piso mujeres: max(BMR, 1200)", () => {
    const r = calorieTarget({ bmrKcal: 1139, sex: "female", weightKg: 50, expenditureKcal: 1370, goal: "lose_fat", pace: "fast" });
    expect(r.kcal).toBe(1200);
  });

  it("mantener y rendimiento = gasto", () => {
    expect(calorieTarget({ ...base, expenditureKcal: 2820, goal: "maintain", pace: "moderate" }).kcal).toBe(2820);
    expect(calorieTarget({ ...base, expenditureKcal: 2824, goal: "performance", pace: "fast" }).kcal).toBe(2820);
  });

  it("recomposición: déficit leve del 10 %", () => {
    expect(calorieTarget({ ...base, expenditureKcal: 3000, goal: "recomp", pace: "fast" }).kcal).toBe(2700);
  });

  it("ganar músculo: superávit 10 % con tope de 350", () => {
    expect(calorieTarget({ ...base, expenditureKcal: 3000, goal: "gain_muscle", pace: "easy" }).kcal).toBe(3300);
    expect(calorieTarget({ ...base, expenditureKcal: 4000, goal: "gain_muscle", pace: "easy" }).kcal).toBe(4350);
  });

  it("ritmos en % del peso por semana", () => {
    expect(PACE_PCT_PER_WEEK).toEqual({ easy: 0.375, moderate: 0.625, fast: 0.875 });
  });
});

describe("macroTargets", () => {
  it("déficit: proteína 2 g/kg, grasa 0,8 g/kg, carbos el resto", () => {
    const r = macroTargets({ kcal: 2270, weightKg: 80, goal: "lose_fat", dayType: "training", expenditureKcal: 2820 });
    expect(r.proteinG).toBe(160);
    expect(r.fatG).toBe(64);
    expect(r.carbsG).toBe(264); // (2270 - 640 - 576) / 4 = 263,5
    expect(r.kcal).toBe(2270);
    expect(r.notes).toEqual([]);
  });

  it("mantener: proteína 1,8 g/kg", () => {
    expect(macroTargets({ kcal: 2800, weightKg: 80, goal: "maintain", dayType: "rest", expenditureKcal: 2800 }).proteinG).toBe(144);
  });

  it("grasa nunca debajo del 20 % de las kcal", () => {
    // 50 kg → 0,8 g/kg = 40 g = 360 kcal; 20 % de 2500 = 500 kcal = 55,6 g
    const r = macroTargets({ kcal: 2500, weightKg: 50, goal: "maintain", dayType: "rest", expenditureKcal: 2500 });
    expect(r.fatG).toBe(56);
  });

  it("piso de carbos (D3): primero baja grasa al 20 %", () => {
    // 1810 kcal, 80 kg: con grasa 64 g → carbos 148; bajando grasa a 20 % (40 g) → 202; sigue < 240
    // → sube kcal a (640 + 960) / 0,8 = 2000 (≤ gasto 2160)
    const r = macroTargets({ kcal: 1810, weightKg: 80, goal: "lose_fat", dayType: "training", expenditureKcal: 2160 });
    expect(r.kcal).toBe(2000);
    expect(r.carbsG).toBe(240);
    expect(r.fatG).toBe(44);
    expect(r.notes).toEqual(["carb_floor_fat_reduced", "carb_floor_kcal_raised"]);
  });

  it("piso de carbos: sólo bajando grasa alcanza", () => {
    // 2150 kcal: con grasa 64 → (2150-640-576)/4 = 233,5 < 240 ; grasa 20 % = 47,8 g → (2150-640-430)/4 = 270
    const r = macroTargets({ kcal: 2150, weightKg: 80, goal: "lose_fat", dayType: "match", expenditureKcal: 2900 });
    expect(r.kcal).toBe(2150);
    expect(r.carbsG).toBeGreaterThanOrEqual(240);
    expect(r.fatG).toBeLessThan(64);
    expect(r.fatG).toBeGreaterThanOrEqual(Math.floor((2150 * 0.2) / 9));
    expect(r.notes).toEqual(["carb_floor_fat_reduced"]);
  });

  it("piso de carbos: no pasa del gasto del día", () => {
    const r = macroTargets({ kcal: 1810, weightKg: 80, goal: "lose_fat", dayType: "training", expenditureKcal: 1950 });
    expect(r.kcal).toBe(1950);
    expect(r.carbsG).toBeLessThan(240);
  });

  it("descanso: sin piso de carbos", () => {
    const r = macroTargets({ kcal: 1810, weightKg: 80, goal: "lose_fat", dayType: "rest", expenditureKcal: 2160 });
    expect(r.kcal).toBe(1810);
    expect(r.carbsG).toBe(149); // 148,5
    expect(r.notes).toEqual([]);
  });

  it("nunca carbos negativos: sube kcal lo justo", () => {
    const r = macroTargets({ kcal: 700, weightKg: 80, goal: "lose_fat", dayType: "rest", expenditureKcal: 2000 });
    expect(r.carbsG).toBe(0);
    expect(r.kcal).toBe(800);
    expect(r.notes).toContain("macro_kcal_raised");
  });
});

describe("waterTarget", () => {
  it("35 ml/kg + 600 ml por hora de actividad, redondeado a 50", () => {
    expect(waterTarget(80, 120)).toBe(4000);
    expect(waterTarget(85, 120)).toBe(4200); // 2975 + 1200 = 4175 → 4200
    expect(waterTarget(70, 0)).toBe(2450);
  });
});

describe("dayTargets", () => {
  const body = { sex: "male" as const, ageYears: 23, heightCm: 185, weightKg: 85 };

  it("día de partido de vóley, bajando grasa moderado", () => {
    const r = dayTargets({
      body,
      goal: "lose_fat",
      pace: "moderate",
      lifestyle: "mixed",
      activities: [{ sport: "volleyball", kind: "match", intensity: "hard", durationMin: 120 }],
    });
    expect(r.dayType).toBe("match");
    expect(r.bmrKcal).toBeCloseTo(1896.25);
    expect(r.expenditureKcal).toBeCloseTo(3315.125);
    expect(r.kcal).toBe(2730);
    expect(r.proteinG).toBe(170);
    expect(r.fatG).toBe(68);
    expect(r.carbsG).toBe(360);
    expect(r.waterMl).toBe(4200);
  });

  it("día de descanso: aplica el piso y no hay piso de carbos", () => {
    const r = dayTargets({ body, goal: "lose_fat", pace: "moderate", lifestyle: "mixed", activities: [] });
    expect(r.dayType).toBe("rest");
    expect(r.kcal).toBe(1900);
    expect(r.notes).toContain("kcal_floor");
    expect(r.carbsG).toBe(152);
  });

  it("más carbos el día de partido que el de descanso", () => {
    const rest = dayTargets({ body, goal: "lose_fat", pace: "moderate", lifestyle: "mixed", activities: [] });
    const match = dayTargets({
      body,
      goal: "lose_fat",
      pace: "moderate",
      lifestyle: "mixed",
      activities: [{ sport: "volleyball", kind: "match", intensity: "hard", durationMin: 120 }],
    });
    expect(match.carbsG).toBeGreaterThan(rest.carbsG);
    expect(match.proteinG).toBe(rest.proteinG);
  });

  it("aplica el offset del TDEE adaptativo al gasto", () => {
    const a = dayTargets({ body, goal: "maintain", pace: "moderate", lifestyle: "mixed", activities: [] });
    const b = dayTargets({ body, goal: "maintain", pace: "moderate", lifestyle: "mixed", activities: [], expenditureOffsetKcal: -150 });
    expect(b.expenditureKcal).toBeCloseTo(a.expenditureKcal - 150);
  });
});
