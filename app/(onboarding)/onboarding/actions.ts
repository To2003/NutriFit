"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/data/me";
import { todayInTz } from "@/lib/dates";
import { STEP_SCHEMAS, TOTAL_STEPS, fieldErrors, firstIssue, type StepNumber } from "@/lib/onboarding/schemas";
import { buildTargetInputs, computeWeek, weekToStored, type StoredTargets } from "@/lib/data/targets";
import type { Json } from "@/lib/supabase/database.types";

export type ActionResult = { ok: true } | { ok: false; error: string; fields?: Record<string, string> };

export async function saveOnboardingStep(step: number, payload: unknown): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Se cortó la sesión. Volvé a entrar." };
  if (!(step in STEP_SCHEMAS)) return { ok: false, error: "Paso inválido" };
  const schema = STEP_SCHEMAS[step as StepNumber];
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error), fields: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const data = parsed.data as import("@/lib/supabase/database.types").TablesUpdate<"profile_details">;

  const fail = (msg: string) => ({ ok: false as const, error: msg });

  switch (step) {
    case 1: {
      const d = parsed.data as import("zod").infer<(typeof STEP_SCHEMAS)[1]>;
      const taken = await supabase.from("profiles").select("id").ilike("username", d.username).neq("id", userId).maybeSingle();
      if (taken.data) return { ok: false, error: "Ese usuario ya está tomado", fields: { username: "Ese usuario ya está tomado" } };
      const p = await supabase.from("profiles").update({ display_name: d.display_name, username: d.username }).eq("id", userId);
      if (p.error) return fail(p.error.code === "23505" ? "Ese usuario ya está tomado" : "No pudimos guardar tu perfil");
      const det = await supabase
        .from("profile_details")
        .update({ birthdate: d.birthdate, sex: d.sex, height_cm: d.height_cm })
        .eq("user_id", userId);
      if (det.error) return fail("No pudimos guardar tus datos");
      const tz = (await supabase.from("profile_details").select("timezone").eq("user_id", userId).single()).data?.timezone;
      const w = await supabase
        .from("weight_logs")
        .upsert({ user_id: userId, log_date: todayInTz(tz ?? undefined), kg: d.weight_kg }, { onConflict: "user_id,log_date" });
      if (w.error) return fail("No pudimos guardar tu peso");
      break;
    }
    case 2:
    case 3:
    case 7: {
      const r = await supabase.from("profile_details").update(data).eq("user_id", userId);
      if (r.error) return fail("No pudimos guardar");
      break;
    }
    case 4: {
      const d = parsed.data as import("zod").infer<(typeof STEP_SCHEMAS)[4]>;
      const del = await supabase.from("user_sports").delete().eq("user_id", userId);
      if (del.error) return fail("No pudimos guardar tus deportes");
      if (d.sports.length) {
        const ins = await supabase
          .from("user_sports")
          .insert(d.sports.map((s) => ({ user_id: userId, sport: s.sport, position: s.position || null, level: s.level })));
        if (ins.error) return fail("No pudimos guardar tus deportes");
      }
      break;
    }
    case 5: {
      const d = parsed.data as import("zod").infer<(typeof STEP_SCHEMAS)[5]>;
      const r = await replaceSchedule(userId, d.schedule);
      if (!r.ok) return r;
      break;
    }
    case 6: {
      const d = parsed.data as import("zod").infer<(typeof STEP_SCHEMAS)[6]>;
      const r = await supabase.from("gym_preferences").upsert({ user_id: userId, ...d, weekdays: [...new Set(d.weekdays)].sort() });
      if (r.error) return fail("No pudimos guardar el gimnasio");
      break;
    }
    case 8: {
      const r = await supabase.from("diet_preferences").upsert({ user_id: userId, ...(parsed.data as import("zod").infer<(typeof STEP_SCHEMAS)[8]>) });
      if (r.error) return fail("No pudimos guardar tus preferencias");
      break;
    }
    case 9: {
      const d = parsed.data as import("zod").infer<(typeof STEP_SCHEMAS)[9]>;
      const r = await supabase
        .from("notification_prefs")
        .upsert({
          user_id: userId,
          enabled: d.enabled,
          water: { on: d.water_on, every_h: d.water_every_h, from: "09:00", to: "21:00" },
          meals: { on: d.meals_on, lunch_by: "14:30", dinner_by: "22:00" },
          gym: { on: d.gym_on, at: "18:00" },
          daily_close: { on: d.daily_close_on, at: d.daily_close_at },
          weekly_review: d.weekly_review,
        });
      if (r.error) return fail("No pudimos guardar los recordatorios");
      break;
    }
    case 10: {
      const d = parsed.data as import("zod").infer<(typeof STEP_SCHEMAS)[10]>;
      const a = await supabase.from("profiles").update({ is_private: d.is_private }).eq("id", userId);
      const b = await supabase.from("privacy_settings").upsert({
        user_id: userId,
        show_streaks: d.show_streaks,
        show_training: d.show_training,
        show_tests: d.show_tests,
        show_meals: d.show_meals,
        show_body: d.show_body,
      });
      const c = await supabase.from("profile_details").update({ ai_notice_accepted_at: new Date().toISOString() }).eq("user_id", userId);
      if (a.error || b.error || c.error) return fail("No pudimos guardar la privacidad");
      break;
    }
  }

  // Avanza el paso guardado (nunca retrocede)
  const cur = await supabase.from("profile_details").select("onboarding_step").eq("user_id", userId).single();
  const next = Math.min(step + 1, TOTAL_STEPS + 1);
  if ((cur.data?.onboarding_step ?? 1) < next) {
    await supabase.from("profile_details").update({ onboarding_step: next }).eq("user_id", userId);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function replaceSchedule(
  userId: string,
  schedule: import("zod").infer<(typeof STEP_SCHEMAS)[5]>["schedule"],
): Promise<ActionResult> {
  const supabase = await createClient();
  const existing = await supabase.from("weekly_schedule").select("id").eq("user_id", userId);
  if (existing.error) return { ok: false, error: "No pudimos guardar tu agenda" };
  if (schedule.length) {
    const ins = await supabase.from("weekly_schedule").insert(schedule.map((s) => ({ ...s, user_id: userId })));
    if (ins.error) return { ok: false, error: "No pudimos guardar tu agenda" };
  }
  const oldIds = (existing.data ?? []).map((r) => r.id);
  if (oldIds.length) await supabase.from("weekly_schedule").delete().in("id", oldIds);
  return { ok: true };
}

/** Calcula y guarda los objetivos. `manual` permite fijar kcal/macros a mano por tipo de día. */
export async function saveGoals(manual?: StoredTargets | null): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Se cortó la sesión. Volvé a entrar." };
  const supabase = await createClient();
  const [details, weight, schedule, gym, prev] = await Promise.all([
    supabase.from("profile_details").select("*").eq("user_id", userId).single(),
    supabase.from("weight_logs").select("kg").eq("user_id", userId).order("log_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("weekly_schedule").select("*").eq("user_id", userId),
    supabase.from("gym_preferences").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("user_goals").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!details.data) return { ok: false, error: "Falta completar tus datos" };
  const inputs = buildTargetInputs({
    details: details.data,
    weightKg: weight.data?.kg,
    schedule: schedule.data ?? [],
    gym: gym.data,
    goals: prev.data,
  });
  if (!inputs) return { ok: false, error: "Faltan datos del onboarding" };
  const week = computeWeek(inputs);
  const auto = weekToStored(week);
  const avgExpenditure = Object.values(week.days).reduce((s, d) => s + d.expenditureKcal, 0) / 7;

  const ins = await supabase.from("user_goals").insert({
    user_id: userId,
    goal: inputs.goal,
    pace: inputs.pace,
    lifestyle: inputs.lifestyle,
    targets: (manual ?? auto) as unknown as Json,
    manual_override: Boolean(manual),
    tdee_estimate: Math.round(avgExpenditure),
    expenditure_offset_kcal: prev.data?.expenditure_offset_kcal ?? 0,
    effective_from: todayInTz(details.data.timezone),
  });
  if (ins.error) return { ok: false, error: "No pudimos guardar tus objetivos" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function finishOnboarding(manual?: StoredTargets | null): Promise<ActionResult> {
  const r = await saveGoals(manual);
  if (!r.ok) return r;
  const userId = (await getUserId())!;
  const supabase = await createClient();
  const u = await supabase.from("profile_details").update({ onboarded_at: new Date().toISOString() }).eq("user_id", userId);
  if (u.error) return { ok: false, error: "No pudimos cerrar el onboarding" };
  revalidatePath("/", "layout");
  return { ok: true };
}
