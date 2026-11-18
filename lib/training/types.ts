export type Pattern =
  | "squat"
  | "hinge"
  | "horizontal_push"
  | "vertical_push"
  | "horizontal_pull"
  | "vertical_pull"
  | "lunge"
  | "plyometric"
  | "core"
  | "carry"
  | "prevention"
  | "power"
  | "sprint"
  | "conditioning"
  | "mobility"
  | "accessory";

export type Region = "lower" | "upper" | "full" | "core";
export type LoadType = "barbell" | "dumbbell" | "kettlebell" | "machine" | "cable" | "bodyweight" | "band" | "other";

export interface ExerciseInfo {
  id: string;
  name: string;
  pattern: Pattern;
  region: Region;
  muscles: string[];
  equipment: string[];
  focus: string[];
  impact: "low" | "medium" | "high";
  level: "beginner" | "intermediate" | "advanced";
  unilateral: boolean;
  load_type: LoadType;
  heavy_lower: boolean;
  alternatives: string[];
}

export interface PlanExercise {
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restS: number;
  rir: number | null;
  notes: string;
}

export interface PlanSession {
  weekday: number;
  name: string;
  exercises: PlanExercise[];
}

export interface WeekPlan {
  sessions: PlanSession[];
}

export interface SportEvent {
  weekday: number;
  sport: string;
  kind: "training" | "match";
  durationMin: number;
}

export interface PlacementContext {
  gymDays: number[];
  events: SportEvent[];
  allowConsecutive: boolean;
}
