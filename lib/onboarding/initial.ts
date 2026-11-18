import type { Me } from "@/lib/data/me";
import type { OnboardingInitial, ScheduleItem } from "@/components/onboarding/types";
import type { Sport } from "@/lib/calc/types";

type Rec = Record<string, unknown>;
const obj = (j: unknown): Rec => (j && typeof j === "object" && !Array.isArray(j) ? (j as Rec) : {});

export function onboardingInitial(me: Me): OnboardingInitial {
  const n = me.notif;
  const water = obj(n?.water);
  const meals = obj(n?.meals);
  const gym = obj(n?.gym);
  const close = obj(n?.daily_close);
  const isPlaceholder = /^user_[0-9a-f]{12}$/.test(me.profile.username);
  return {
    basics: {
      display_name: me.profile.display_name ?? "",
      username: isPlaceholder ? "" : me.profile.username,
      birthdate: me.details.birthdate ?? "",
      sex: (me.details.sex as "male" | "female" | null) ?? "",
      height_cm: me.details.height_cm ? String(me.details.height_cm) : "",
      weight_kg: me.latestWeight ? String(me.latestWeight.kg) : "",
    },
    goal: { goal: me.details.goal, pace: (me.details.pace as "easy" | "moderate" | "fast") ?? "moderate" },
    lifestyle: me.details.lifestyle,
    sports: me.sports.map((s) => ({
      sport: s.sport as Sport,
      position: s.position,
      level: s.level as "recreational" | "amateur" | "federated",
    })),
    schedule: me.schedule.map(
      (s): ScheduleItem => ({
        weekday: s.weekday,
        sport: s.sport as Sport,
        kind: s.kind as "training" | "match",
        start_time: s.start_time ? s.start_time.slice(0, 5) : null,
        duration_min: s.duration_min,
        intensity: s.intensity as ScheduleItem["intensity"],
      }),
    ),
    gym: {
      weekdays: me.gym?.weekdays ?? [],
      minutes: me.gym?.minutes ?? 60,
      preferred_time: me.gym?.preferred_time ? me.gym.preferred_time.slice(0, 5) : null,
      equipment: me.gym?.equipment ?? ["full_gym"],
      experience: (me.gym?.experience as OnboardingInitial["gym"]["experience"]) ?? "beginner",
      injuries: me.gym?.injuries ?? "",
      allow_consecutive: me.gym?.allow_consecutive ?? false,
    },
    focus: { focus_primary: me.details.focus_primary, focus_secondary: me.details.focus_secondary },
    diet: {
      diet_type: (me.diet?.diet_type as OnboardingInitial["diet"]["diet_type"]) ?? "omnivore",
      meals_per_day: me.diet?.meals_per_day ?? 4,
      dislikes: me.diet?.dislikes ?? [],
      allergies: me.diet?.allergies ?? "",
      cooking_time: (me.diet?.cooking_time as OnboardingInitial["diet"]["cooking_time"]) ?? "normal",
    },
    notif: {
      enabled: n?.enabled ?? false,
      water_on: (water.on as boolean) ?? true,
      water_every_h: (water.every_h as number) ?? 2,
      meals_on: (meals.on as boolean) ?? true,
      gym_on: (gym.on as boolean) ?? true,
      daily_close_on: (close.on as boolean) ?? true,
      daily_close_at: (close.at as string) ?? "22:00",
      weekly_review: n?.weekly_review ?? true,
    },
    privacy: {
      is_private: me.profile.is_private,
      show_streaks: me.privacy?.show_streaks ?? true,
      show_training: me.privacy?.show_training ?? true,
      show_tests: me.privacy?.show_tests ?? true,
      show_meals: me.privacy?.show_meals ?? false,
      show_body: me.privacy?.show_body ?? false,
      ai_notice: Boolean(me.details.ai_notice_accepted_at),
    },
  };
}
