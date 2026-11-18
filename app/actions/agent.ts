"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUserId, loadMe } from "@/lib/data/me";
import { loadDay } from "@/lib/data/day";
import { getAI } from "@/lib/ai/provider";
import { runAI } from "@/lib/ai/run";
import { aiSuggestSchema } from "@/lib/ai/schemas/suggest";
import { PROFE_PERSONA } from "@/lib/ai/prompts/persona";
import { dayContext, profileContext } from "@/lib/ai/context";
import { fallbackIdeas, type MealIdea } from "@/lib/agent/suggest-fallback";
import { violatesGuardrails } from "@/lib/agent/guardrails";
import { draftsFromAI } from "@/lib/food/draft";
import type { DraftItem } from "@/lib/food/types";
import { MEALS } from "@/lib/domain/catalog";

type Fail = { ok: false; error: string };

export async function suggestMealsAction(input: { meal: string; pantry: string }): Promise<{ ok: true; ideas: MealIdea[]; source: "ai" | "fallback" } | Fail> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Se cortó la sesión" };
  const p = z.object({ meal: z.enum(["breakfast", "lunch", "snack", "dinner", "extra"]), pantry: z.string().max(300) }).safeParse(input);
  if (!p.success) return { ok: false, error: "Datos inválidos" };
  const supabase = await createClient();
  const me = await loadMe(supabase, userId);
  if (!me) return { ok: false, error: "No encontramos tu perfil" };
  const day = await loadDay(supabase, me, me.today);
  const t = day.targets;
  const remaining = {
    kcal: Math.max(0, (t?.kcal ?? 2000) - day.totals.kcal),
    protein: Math.max(0, (t?.proteinG ?? 120) - day.totals.protein_g),
    carbs: Math.max(0, (t?.carbsG ?? 250) - day.totals.carbs_g),
    fat: Math.max(0, (t?.fatG ?? 60) - day.totals.fat_g),
  };
  const mealsLeft = Math.max(1, (me.diet?.meals_per_day ?? 4) - day.meals.length);
  const fallback = () =>
    fallbackIdeas({
      meal: p.data.meal,
      diet: (me.diet?.diet_type as "omnivore" | "vegetarian" | "vegan" | "other") ?? "omnivore",
      dislikes: me.diet?.dislikes ?? [],
      allergies: me.diet?.allergies ?? "",
      cookingTime: (me.diet?.cooking_time as "low" | "normal" | "high") ?? "normal",
      pantry: p.data.pantry,
      remaining,
      mealsLeft,
    });

  const out = await runAI<MealIdea[]>({
    supabase,
    call: async () => {
      const r = await getAI().generateJSON({
        system: `${PROFE_PERSONA}
Proponé 3 opciones de comida argentinas, simples y realistas, con receta corta.
- Respetá el tipo de alimentación, lo que no le gusta y las alergias (NUNCA las incluyas).
- Ajustá el tiempo de preparación al tiempo para cocinar.
- Si dice qué tiene en casa, priorizá eso.
- Apuntá a cubrir lo que le falta del día repartido en las comidas que quedan; priorizá la proteína.
- Ingredientes con gramos y macros TOTALES de cada ingrediente.`,
        prompt: JSON.stringify({
          momento: MEALS.find((m) => m.value === p.data.meal)?.label,
          le_falta_hoy: remaining,
          comidas_que_quedan: mealsLeft,
          tiene_en_casa: p.data.pantry || "no dijo",
          perfil: profileContext(me),
          hoy: dayContext(me, day),
        }),
        schema: aiSuggestSchema,
        temperature: 0.8,
      });
      const ideas = r.opciones.map((o) => {
        const sum = (k: "kcal" | "proteina" | "carbos" | "grasa") => Math.round(o.ingredientes.reduce((s, i) => s + i[k], 0));
        return {
          nombre: o.nombre,
          receta: o.receta,
          tiempo_min: o.tiempo_min,
          ingredientes: o.ingredientes.map((i) => ({ nombre: i.nombre, gramos: i.gramos_estimados, kcal: i.kcal, proteina: i.proteina, carbos: i.carbos, grasa: i.grasa })),
          kcal: sum("kcal"),
          proteina: sum("proteina"),
          carbos: sum("carbos"),
          grasa: sum("grasa"),
        };
      });
      if (ideas.some((i) => violatesGuardrails(`${i.nombre} ${i.receta}`))) throw new Error("guardrail");
      // alergias: filtro duro
      const allergens = (me.diet?.allergies ?? "").toLowerCase().split(/[,;]/).map((s) => s.trim()).filter((s) => s.length > 2);
      const safe = ideas.filter((i) => !allergens.some((a) => `${i.nombre} ${i.receta} ${i.ingredientes.map((x) => x.nombre).join(" ")}`.toLowerCase().includes(a)));
      if (!safe.length) throw new Error("alergias");
      return safe;
    },
    fallback,
  });
  await supabase.from("agent_messages").insert({
    user_id: userId,
    kind: "meal_suggestion",
    for_date: me.today,
    content: { text: `Ideas para ${MEALS.find((m) => m.value === p.data.meal)?.label.toLowerCase()}: ${out.data.map((i) => i.nombre).join(", ")}.`, ideas: out.data.map((i) => i.nombre) },
    source: out.source,
  });
  return { ok: true, ideas: out.data, source: out.source };
}

/** Convierte una idea en ítems editables (matchea con la base cuando puede). */
export async function ideaToDraftAction(idea: MealIdea): Promise<{ ok: true; items: DraftItem[] } | Fail> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Se cortó la sesión" };
  const supabase = await createClient();
  const items = await draftsFromAI(
    supabase,
    idea.ingredientes.slice(0, 10).map((i) => ({
      nombre: i.nombre.slice(0, 80),
      cantidad: 1,
      unidad: "porción",
      gramos_estimados: Math.max(1, Math.min(3000, i.gramos)),
      kcal: Math.max(0, i.kcal),
      proteina: Math.max(0, i.proteina),
      carbos: Math.max(0, i.carbos),
      grasa: Math.max(0, i.grasa),
      confianza: 0.8,
    })),
  );
  return { ok: true, items };
}

// ── Cierre del día / revisión semanal a demanda ─────────────────────────────

export async function generateDailyCloseAction(): Promise<{ ok: true; text: string } | Fail> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Se cortó la sesión" };
  const supabase = await createClient();
  const me = await loadMe(supabase, userId);
  if (!me) return { ok: false, error: "No encontramos tu perfil" };
  const { generateDailyClose } = await import("@/lib/agent/daily");
  const r = await generateDailyClose(supabase, me, me.today);
  if (!r) return { ok: false, error: "No pudimos armar el cierre" };
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/inicio");
  return { ok: true, text: r.text };
}

export async function generateWeeklyReviewAction(): Promise<{ ok: true } | Fail> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Se cortó la sesión" };
  const supabase = await createClient();
  const me = await loadMe(supabase, userId);
  if (!me) return { ok: false, error: "No encontramos tu perfil" };
  const { generateWeeklyReview } = await import("@/lib/agent/weekly");
  await generateWeeklyReview(supabase, me);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/inicio");
  return { ok: true };
}

export async function toggleWeeklyGoalAction(id: string, done: boolean): Promise<{ ok: boolean }> {
  const userId = await getUserId();
  if (!userId) return { ok: false };
  const supabase = await createClient();
  const r = await supabase.from("weekly_goals").update({ done }).eq("id", id).eq("user_id", userId);
  return { ok: !r.error };
}

export async function respondTdeeAction(id: string, accept: boolean): Promise<{ ok: true } | Fail> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Se cortó la sesión" };
  const supabase = await createClient();
  const p = await supabase.from("tdee_proposals").select("*").eq("id", id).eq("user_id", userId).eq("status", "pending").maybeSingle();
  if (!p.data) return { ok: false, error: "La propuesta ya no está disponible" };
  await supabase.from("tdee_proposals").update({ status: accept ? "accepted" : "rejected" }).eq("id", id);
  if (accept) {
    const g = await supabase.from("user_goals").select("expenditure_offset_kcal, manual_override, targets").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const offset = (g.data?.expenditure_offset_kcal ?? 0) + (Number(p.data.proposed_tdee) - Number(p.data.previous_tdee));
    const { saveGoals } = await import("@/app/(onboarding)/onboarding/actions");
    const r = await saveGoals(null, { offsetKcal: Math.round(offset) });
    if (!r.ok) return r;
  }
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/", "layout");
  return { ok: true };
}
