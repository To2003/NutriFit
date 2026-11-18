import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import type { AIFoodItem } from "@/lib/ai/schemas/food";
import { bestMatch, MATCH_THRESHOLD } from "./match";
import { roughGrams, roughParse } from "./parse-fallback";
import { searchLocal } from "./search";
import type { DraftItem, FoodRow } from "./types";

const key = () => Math.random().toString(36).slice(2, 10);

export function draftFromFood(food: FoodRow, grams: number): DraftItem {
  return {
    key: key(),
    foodId: food.id.startsWith("ext-") ? null : food.id,
    name: food.brand && food.source !== "local" ? `${food.name} (${food.brand})` : food.name,
    grams,
    per100: { kcal: food.kcal, protein_g: food.protein_g, carbs_g: food.carbs_g, fat_g: food.fat_g },
    totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    source: food.source,
    confidence: null,
    portions: food.portions.length ? food.portions : [{ label: "100 g", grams: 100 }],
  };
}

/** Ítems de la IA → borradores; si matchean con la base, se usan los valores de la base × gramos. */
export async function draftsFromAI(supabase: ServerClient, items: AIFoodItem[]): Promise<DraftItem[]> {
  return Promise.all(
    items.map(async (it) => {
      const candidates = await searchLocal(supabase, it.nombre, 15);
      const m = bestMatch(it.nombre, candidates);
      if (m && m.score >= MATCH_THRESHOLD && it.gramos_estimados > 0) {
        return { ...draftFromFood(m.food, Math.round(it.gramos_estimados)), confidence: it.confianza };
      }
      return {
        key: key(),
        foodId: null,
        name: it.nombre,
        grams: Math.max(1, Math.round(it.gramos_estimados)),
        per100: null,
        totals: { kcal: Math.round(it.kcal), protein_g: it.proteina, carbs_g: it.carbos, fat_g: it.grasa },
        source: "ai_estimate" as const,
        confidence: it.confianza,
        portions: [
          { label: `${it.cantidad} ${it.unidad}`.trim(), grams: Math.max(1, Math.round(it.gramos_estimados)) },
          { label: "100 g", grams: 100 },
        ],
      };
    }),
  );
}

/** Sin IA: parser por reglas + base local. Lo que no encuentra queda en 0 para que lo edites o busques. */
export async function draftsFromText(supabase: ServerClient, text: string): Promise<{ items: DraftItem[]; missing: string[] }> {
  const rough = roughParse(text);
  const items: DraftItem[] = [];
  const missing: string[] = [];
  for (const r of rough) {
    const candidates = await searchLocal(supabase, r.text, 15);
    const m = bestMatch(r.text, candidates);
    if (m) items.push(draftFromFood(m.food, roughGrams(r, m.food.portions)));
    else missing.push(r.text);
  }
  return { items, missing };
}
