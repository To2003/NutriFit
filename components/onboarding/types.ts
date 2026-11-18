import type { Sport } from "@/lib/calc/types";

export interface ScheduleItem {
  weekday: number;
  sport: Sport;
  kind: "training" | "match";
  start_time: string | null;
  duration_min: number;
  intensity: "light" | "moderate" | "hard";
}

export interface OnboardingInitial {
  basics: {
    display_name: string;
    username: string;
    birthdate: string;
    sex: "male" | "female" | "";
    height_cm: string;
    weight_kg: string;
  };
  goal: { goal: string | null; pace: "easy" | "moderate" | "fast" };
  lifestyle: string | null;
  sports: { sport: Sport; position: string | null; level: "recreational" | "amateur" | "federated" }[];
  schedule: ScheduleItem[];
  gym: {
    weekdays: number[];
    minutes: number;
    preferred_time: string | null;
    equipment: string[];
    experience: "beginner" | "intermediate" | "advanced";
    injuries: string;
    allow_consecutive: boolean;
  };
  focus: { focus_primary: string | null; focus_secondary: string | null };
  diet: {
    diet_type: "omnivore" | "vegetarian" | "vegan" | "other";
    meals_per_day: number;
    dislikes: string[];
    allergies: string;
    cooking_time: "low" | "normal" | "high";
  };
  notif: {
    enabled: boolean;
    water_on: boolean;
    water_every_h: number;
    meals_on: boolean;
    gym_on: boolean;
    daily_close_on: boolean;
    daily_close_at: string;
    weekly_review: boolean;
  };
  privacy: {
    is_private: boolean;
    show_streaks: boolean;
    show_training: boolean;
    show_tests: boolean;
    show_meals: boolean;
    show_body: boolean;
    ai_notice: boolean;
  };
}
