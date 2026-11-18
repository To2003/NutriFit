import { bmrMifflin } from "./bmr";
import { activityMinutes, dayExpenditure, dayTypeOf } from "./energy";
import type { Activity, BodyData, DayTargets, DayType, Goal, Lifestyle, Pace, Sex, TargetNote } from "./types";

/** Ritmo de pérdida en % del peso corporal por semana (punto medio de cada rango del spec). */
export const PACE_PCT_PER_WEEK: Record<Pace, number> = { easy: 0.375, moderate: 0.625, fast: 0.875 };

export const KCAL_PER_KG_FAT = 7700;
export const MAX_DEFICIT_FRACTION = 0.25;
export const RECOMP_DEFICIT_FRACTION = 0.1;
export const GAIN_SURPLUS_FRACTION = 0.1;
export const GAIN_SURPLUS_MAX_KCAL = 350;
export const MIN_FAT_FRACTION = 0.2;
export const FAT_G_PER_KG = 0.8;
/** D3: piso de carbohidratos en días de entreno o partido. */
export const CARB_FLOOR_G_PER_KG = 3;

const round10 = (x: number) => Math.round(x / 10) * 10;
const ceil10 = (x: number) => Math.ceil(x / 10) * 10;

export function kcalFloor(bmrKcal: number, sex: Sex): number {
  return Math.max(bmrKcal, sex === "male" ? 1500 : 1200);
}

export function isDeficitGoal(goal: Goal): boolean {
  return goal === "lose_fat" || goal === "recomp";
}

export function calorieTarget(input: {
  bmrKcal: number;
  sex: Sex;
  weightKg: number;
  expenditureKcal: number;
  goal: Goal;
  pace: Pace;
}): { kcal: number; notes: TargetNote[] } {
  const { bmrKcal, sex, weightKg, expenditureKcal, goal, pace } = input;
  const notes: TargetNote[] = [];
  let kcal = expenditureKcal;

  if (goal === "lose_fat") {
    const kgPerWeek = (weightKg * PACE_PCT_PER_WEEK[pace]) / 100;
    let deficit = (kgPerWeek * KCAL_PER_KG_FAT) / 7;
    const cap = expenditureKcal * MAX_DEFICIT_FRACTION;
    if (deficit > cap) {
      deficit = cap;
      notes.push("deficit_capped");
    }
    kcal = expenditureKcal - deficit;
  } else if (goal === "recomp") {
    kcal = expenditureKcal * (1 - RECOMP_DEFICIT_FRACTION);
  } else if (goal === "gain_muscle") {
    kcal = expenditureKcal + Math.min(expenditureKcal * GAIN_SURPLUS_FRACTION, GAIN_SURPLUS_MAX_KCAL);
  }

  kcal = round10(kcal);
  const floor = kcalFloor(bmrKcal, sex);
  if (kcal < floor) {
    kcal = ceil10(floor);
    notes.push("kcal_floor");
  }
  return { kcal, notes };
}

export function macroTargets(input: {
  kcal: number;
  weightKg: number;
  goal: Goal;
  dayType: DayType;
  expenditureKcal: number;
}): { kcal: number; proteinG: number; carbsG: number; fatG: number; notes: TargetNote[] } {
  const { weightKg, goal, dayType, expenditureKcal } = input;
  const notes: TargetNote[] = [];
  let kcal = input.kcal;

  const proteinG = Math.round(weightKg * (isDeficitGoal(goal) ? 2.0 : 1.8));
  const proteinKcal = proteinG * 4;
  const minFatG = (k: number) => (k * MIN_FAT_FRACTION) / 9;
  let fatG = Math.max(weightKg * FAT_G_PER_KG, minFatG(kcal));
  const carbsOf = (k: number, f: number) => (k - proteinKcal - f * 9) / 4;

  const carbFloorG = dayType === "rest" ? 0 : weightKg * CARB_FLOOR_G_PER_KG;
  let carbsG = carbsOf(kcal, fatG);

  if (carbsG < carbFloorG) {
    // 1) bajar grasa lo necesario, sin pasar el 20 % de las kcal
    const fatNeeded = (kcal - proteinKcal - carbFloorG * 4) / 9;
    const newFat = Math.max(minFatG(kcal), Math.min(fatG, fatNeeded));
    if (newFat < fatG) {
      fatG = newFat;
      if (carbFloorG > 0) notes.push("carb_floor_fat_reduced");
    }
    carbsG = carbsOf(kcal, fatG);

    // 2) si no alcanza, subir kcal (achicar el déficit) sin pasar el gasto del día
    if (carbsG < carbFloorG) {
      const needed = (proteinKcal + carbFloorG * 4) / (1 - MIN_FAT_FRACTION);
      const ceiling = carbFloorG > 0 ? Math.max(kcal, expenditureKcal) : needed;
      const raised = Math.min(ceil10(needed), Math.max(kcal, Math.floor(ceiling)));
      if (raised > kcal) {
        kcal = raised;
        notes.push(carbFloorG > 0 ? "carb_floor_kcal_raised" : "macro_kcal_raised");
      }
      fatG = Math.max(minFatG(kcal), Math.min(fatG, (kcal - proteinKcal - carbFloorG * 4) / 9));
      carbsG = carbsOf(kcal, fatG);
    }
  }

  return {
    kcal,
    proteinG,
    fatG: Math.round(fatG),
    carbsG: Math.max(0, Math.round(carbsG)),
    notes,
  };
}

/** Agua (ml): 35 ml × kg + 600 ml por hora de actividad. Redondeado a 50 ml. */
export function waterTarget(weightKg: number, activityMin: number): number {
  const ml = 35 * weightKg + 600 * (Math.max(0, activityMin) / 60);
  return Math.round(ml / 50) * 50;
}

export interface DayTargetsInput {
  body: BodyData;
  goal: Goal;
  pace: Pace;
  lifestyle: Lifestyle;
  activities: Activity[];
  /** Corrección del TDEE adaptativo (kcal/día). */
  expenditureOffsetKcal?: number;
}

export function dayTargets(input: DayTargetsInput): DayTargets {
  const { body, goal, pace, lifestyle, activities } = input;
  const bmrKcal = bmrMifflin(body);
  const expenditureKcal = dayExpenditure({
    bmrKcal,
    lifestyle,
    weightKg: body.weightKg,
    activities,
    expenditureOffsetKcal: input.expenditureOffsetKcal,
  });
  const dayType = dayTypeOf(activities);
  const cal = calorieTarget({ bmrKcal, sex: body.sex, weightKg: body.weightKg, expenditureKcal, goal, pace });
  const mac = macroTargets({ kcal: cal.kcal, weightKg: body.weightKg, goal, dayType, expenditureKcal });
  return {
    dayType,
    bmrKcal,
    expenditureKcal,
    kcal: mac.kcal,
    proteinG: mac.proteinG,
    carbsG: mac.carbsG,
    fatG: mac.fatG,
    waterMl: waterTarget(body.weightKg, activityMinutes(activities)),
    notes: [...cal.notes, ...mac.notes],
  };
}
