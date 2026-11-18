import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, type ServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { DEFAULT_TZ, todayInTz } from "@/lib/dates";

export interface Me {
  userId: string;
  profile: Tables<"profiles">;
  details: Tables<"profile_details">;
  privacy: Tables<"privacy_settings"> | null;
  sports: Tables<"user_sports">[];
  schedule: Tables<"weekly_schedule">[];
  gym: Tables<"gym_preferences"> | null;
  diet: Tables<"diet_preferences"> | null;
  notif: Tables<"notification_prefs"> | null;
  latestWeight: Tables<"weight_logs"> | null;
  goals: Tables<"user_goals"> | null;
  tz: string;
  today: string;
}

/** Id del usuario logueado, o null. */
export const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
});

export async function requireUserId(): Promise<string> {
  const id = await getUserId();
  if (!id) redirect("/login");
  return id;
}

/** Carga todo lo del usuario actual (memoizado por request). */
export const getMe = cache(async (): Promise<Me | null> => {
  const userId = await getUserId();
  if (!userId) return null;
  const supabase = await createClient();
  return loadMe(supabase, userId);
});

export async function loadMe(supabase: ServerClient, userId: string): Promise<Me | null> {
  const [profile, details, privacy, sports, schedule, gym, diet, notif, weight, goals] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("profile_details").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("privacy_settings").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("user_sports").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("weekly_schedule").select("*").eq("user_id", userId).order("weekday").order("start_time"),
    supabase.from("gym_preferences").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("diet_preferences").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("notification_prefs").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("weight_logs").select("*").eq("user_id", userId).order("log_date", { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from("user_goals")
      .select("*")
      .eq("user_id", userId)
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!profile.data || !details.data) return null;
  const tz = details.data.timezone || DEFAULT_TZ;
  return {
    userId,
    profile: profile.data,
    details: details.data,
    privacy: privacy.data,
    sports: sports.data ?? [],
    schedule: schedule.data ?? [],
    gym: gym.data,
    diet: diet.data,
    notif: notif.data,
    latestWeight: weight.data,
    goals: goals.data,
    tz,
    today: todayInTz(tz),
  };
}

/** Para páginas de la app: exige sesión y onboarding completo. */
export async function requireMe(): Promise<Me> {
  const me = await getMe();
  if (!me) redirect("/login");
  if (!me.details.onboarded_at) redirect(onboardingPath(me.details.onboarding_step));
  return me;
}

/** Adónde retomar el onboarding según el último paso guardado. */
export function onboardingPath(step: number): string {
  return step > 10 ? "/onboarding/objetivos" : `/onboarding/${Math.max(step, 1)}`;
}
