"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUserId, loadMe } from "@/lib/data/me";
import { TEST_INFO, type TestKind } from "@/lib/domain/tests";
import { unlockAchievements } from "@/lib/gamification/unlock";

type Res = { ok: true; message?: string } | { ok: false; error: string };
const cm = z.number().min(10).max(250).nullable();

export async function logMeasurementsAction(input: { waist: number | null; hip: number | null; chest: number | null; arm: number | null; thigh: number | null; neck: number | null }): Promise<Res> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Se cortó la sesión" };
  const p = z.object({ waist: cm, hip: cm, chest: cm, arm: cm, thigh: cm, neck: cm }).safeParse(input);
  if (!p.success) return { ok: false, error: "Revisá las medidas (en cm)" };
  if (Object.values(p.data).every((v) => v == null)) return { ok: false, error: "Cargá al menos una medida" };
  const supabase = await createClient();
  const me = await loadMe(supabase, userId);
  if (!me) return { ok: false, error: "Sin perfil" };
  const r = await supabase.from("body_measurements").insert({
    user_id: userId,
    log_date: me.today,
    waist_cm: p.data.waist,
    hip_cm: p.data.hip,
    chest_cm: p.data.chest,
    arm_cm: p.data.arm,
    thigh_cm: p.data.thigh,
    neck_cm: p.data.neck,
  });
  if (r.error) return { ok: false, error: "No pudimos guardar" };
  revalidatePath("/perfil/progreso");
  return { ok: true, message: "Medidas anotadas. La próxima, en 2 semanas." };
}

export async function logTestAction(input: { test: TestKind; value: number }): Promise<Res> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Se cortó la sesión" };
  if (!(input.test in TEST_INFO) || !(input.value > 0) || input.value > 1000) return { ok: false, error: "Valor inválido" };
  const supabase = await createClient();
  const me = await loadMe(supabase, userId);
  if (!me) return { ok: false, error: "Sin perfil" };
  const info = TEST_INFO[input.test];
  const r = await supabase.from("fitness_tests").insert({ user_id: userId, log_date: me.today, test: input.test, value: input.value, unit: info.unit });
  if (r.error) return { ok: false, error: "No pudimos guardar" };
  const codes = ["first_test"];
  let message = "Test anotado. El próximo, en 4 semanas.";
  const first = await supabase.from("fitness_tests").select("value").eq("user_id", userId).eq("test", input.test).order("log_date").order("created_at").limit(1).maybeSingle();
  if (first.data) {
    const delta = input.value - Number(first.data.value);
    if (input.test === "cmj") {
      if (delta >= 3) codes.push("jump_plus_3");
      if (delta >= 5) codes.push("jump_plus_5");
    }
    const better = info.higherIsBetter ? delta > 0 : delta < 0;
    if (Math.abs(delta) > 0 && better) message = `¡Mejoraste ${Math.abs(Math.round(delta * 100) / 100)} ${info.unit} desde tu primer test! 🔥`;
  }
  await unlockAchievements(supabase, userId, codes);
  revalidatePath("/", "layout");
  return { ok: true, message };
}
