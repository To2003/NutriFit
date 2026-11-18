"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/data/me";
import { activityKcal } from "@/lib/calc/energy";
import { metFor } from "@/lib/calc/mets";
import { SPORTS } from "@/lib/calc/types";
import { feedbackAfterLog } from "@/lib/agent/feedback";

type Res = { ok: true; feedback?: string | null } | { ok: false; error: string };
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function ctx() {
  const userId = await getUserId();
  if (!userId) return null;
  return { userId, supabase: await createClient() };
}

export async function addWaterAction(input: { ml: number; date: string }): Promise<Res> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Se cortó la sesión" };
  const p = z.object({ ml: z.number().int().min(1).max(5000), date }).safeParse(input);
  if (!p.success) return { ok: false, error: "Cantidad inválida" };
  const r = await c.supabase.from("water_logs").insert({ user_id: c.userId, ml: p.data.ml, log_date: p.data.date });
  if (r.error) return { ok: false, error: "No pudimos sumar el agua" };
  revalidatePath("/", "layout");
  const feedback = await feedbackAfterLog(c.supabase, c.userId, { kind: "water", date: p.data.date });
  return { ok: true, feedback };
}

export async function undoLastWaterAction(input: { date: string }): Promise<Res> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Se cortó la sesión" };
  const last = await c.supabase
    .from("water_logs")
    .select("id")
    .eq("user_id", c.userId)
    .eq("log_date", input.date)
    .order("logged_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last.data) await c.supabase.from("water_logs").delete().eq("id", last.data.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function logWeightAction(input: { kg: number; date: string }): Promise<Res> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Se cortó la sesión" };
  const p = z.object({ kg: z.number().min(25).max(350), date }).safeParse(input);
  if (!p.success) return { ok: false, error: "Revisá el peso" };
  const r = await c.supabase
    .from("weight_logs")
    .upsert({ user_id: c.userId, kg: Math.round(p.data.kg * 100) / 100, log_date: p.data.date }, { onConflict: "user_id,log_date" });
  if (r.error) return { ok: false, error: "No pudimos guardar el peso" };
  revalidatePath("/", "layout");
  const feedback = await feedbackAfterLog(c.supabase, c.userId, { kind: "weight", date: p.data.date });
  return { ok: true, feedback };
}

const activitySchema = z.object({
  date,
  sport: z.enum(SPORTS),
  kind: z.enum(["training", "match"]),
  intensity: z.enum(["light", "moderate", "hard"]),
  duration_min: z.number().int().min(0).max(600),
  status: z.enum(["done", "skipped"]).default("done"),
  schedule_id: z.string().uuid().nullable().optional(),
});

export async function logActivityAction(input: z.input<typeof activitySchema>): Promise<Res> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Se cortó la sesión" };
  const p = activitySchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Revisá la actividad" };
  const d = p.data;
  const weight = await c.supabase.from("weight_logs").select("kg").eq("user_id", c.userId).order("log_date", { ascending: false }).limit(1).maybeSingle();
  const kg = Number(weight.data?.kg ?? 70);
  const met = metFor(d);
  const kcal = d.status === "done" ? Math.round(activityKcal({ ...d, durationMin: d.duration_min }, kg)) : 0;

  // Si ya había registro de esa actividad de agenda ese día, se reemplaza
  if (d.schedule_id) {
    await c.supabase.from("activity_logs").delete().eq("user_id", c.userId).eq("log_date", d.date).eq("schedule_id", d.schedule_id);
  }
  const r = await c.supabase.from("activity_logs").insert({
    user_id: c.userId,
    log_date: d.date,
    sport: d.sport,
    kind: d.kind,
    intensity: d.intensity,
    duration_min: d.status === "done" ? d.duration_min : 0,
    status: d.status,
    met,
    kcal,
    schedule_id: d.schedule_id ?? null,
  });
  if (r.error) return { ok: false, error: "No pudimos guardar la actividad" };
  revalidatePath("/", "layout");
  const feedback = d.status === "done" ? await feedbackAfterLog(c.supabase, c.userId, { kind: "activity", date: d.date }) : null;
  return { ok: true, feedback };
}

export async function deleteActivityAction(id: string): Promise<Res> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Se cortó la sesión" };
  await c.supabase.from("activity_logs").delete().eq("id", id).eq("user_id", c.userId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markMessageReadAction(id: string): Promise<void> {
  const c = await ctx();
  if (!c) return;
  await c.supabase.from("agent_messages").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", c.userId);
}
