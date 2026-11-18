export type Sex = "male" | "female";
export type Goal = "lose_fat" | "recomp" | "maintain" | "gain_muscle" | "performance";
export type Pace = "easy" | "moderate" | "fast";
export type Lifestyle = "sedentary" | "mixed" | "standing" | "physical";
export type DayType = "rest" | "training" | "match";
export type Intensity = "light" | "moderate" | "hard";
export type SessionKind = "training" | "match";

export const SPORTS = [
  "volleyball",
  "beach_volleyball",
  "field_hockey",
  "football",
  "basketball",
  "handball",
  "rugby",
  "padel_tennis",
  "running",
  "swimming",
  "cycling",
  "walking",
  "gym",
  "other",
] as const;
export type Sport = (typeof SPORTS)[number];

/** Una actividad de un día (planificada en la agenda o registrada). */
export interface Activity {
  sport: Sport;
  kind: SessionKind;
  intensity: Intensity;
  durationMin: number;
}

export interface BodyData {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
}

export interface MacroTargets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface DayTargets extends MacroTargets {
  dayType: DayType;
  bmrKcal: number;
  expenditureKcal: number;
  waterMl: number;
  /** Ajustes que aplicó el motor, para explicarlos en la UI. */
  notes: TargetNote[];
}

export type TargetNote =
  | "deficit_capped"
  | "kcal_floor"
  | "carb_floor_fat_reduced"
  | "carb_floor_kcal_raised"
  | "macro_kcal_raised";
