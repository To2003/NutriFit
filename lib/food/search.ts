import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import { normalize, tokens } from "@/lib/text";
import { matchScore } from "./match";
import { searchOFF, searchUSDA } from "./external";
import type { FoodRow } from "./types";

type DbFood = {
  id: string;
  name: string;
  brand: string | null;
  source: string;
  external_id: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  portions: unknown;
  aliases: string[];
  verified: boolean;
};

export function toFoodRow(f: DbFood): FoodRow {
  return {
    id: f.id,
    name: f.name,
    brand: f.brand,
    source: f.source as FoodRow["source"],
    external_id: f.external_id,
    kcal: Number(f.kcal),
    protein_g: Number(f.protein_g),
    carbs_g: Number(f.carbs_g),
    fat_g: Number(f.fat_g),
    fiber_g: f.fiber_g == null ? null : Number(f.fiber_g),
    portions: Array.isArray(f.portions) ? (f.portions as FoodRow["portions"]) : [],
    aliases: f.aliases ?? [],
    verified: f.verified,
  };
}

/** Busca en la base (local + caché + propios). Ordena por puntaje de coincidencia. */
export async function searchLocal(supabase: ServerClient, q: string, limit = 20): Promise<FoodRow[]> {
  const toks = tokens(q).slice(0, 4);
  if (toks.length === 0) return [];
  // prefiltro amplio: cualquier alimento que contenga alguna palabra (o alias); el ranking fino lo hace matchScore
  const keys = [...new Set(toks.map((k) => k.slice(0, Math.max(3, k.length - 1))))].slice(0, 3);
  const results = await Promise.all(keys.map((k) => supabase.from("foods").select("*").or(`search_name.ilike.%${k}%,aliases.cs.{${k}}`).limit(60)));
  const seen = new Set<string>();
  const data = results.flatMap((r) => r.data ?? []).filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)));
  const rows = (data ?? []).map(toFoodRow);
  const nq = normalize(q);
  return rows
    .map((f) => ({ f, s: matchScore(q, f) + (f.source === "local" ? 0.08 : 0) + (normalize(f.name).startsWith(nq) ? 0.1 : 0) }))
    .filter((x) => x.s > 0.25)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.f);
}

/** Busca afuera (OFF + USDA) y cachea en `foods` para la próxima. */
export async function searchExternal(supabase: ServerClient, userId: string, q: string): Promise<FoodRow[]> {
  const [off, usda] = await Promise.all([searchOFF(q), searchUSDA(q)]);
  const all = [...off, ...usda].slice(0, 16);
  if (all.length === 0) return [];
  await supabase.from("foods").upsert(
    all.map((f) => ({
      name: f.name.slice(0, 120),
      brand: f.brand,
      source: f.source,
      external_id: f.external_id,
      kcal: f.kcal,
      protein_g: f.protein_g,
      carbs_g: f.carbs_g,
      fat_g: f.fat_g,
      fiber_g: f.fiber_g ?? null,
      portions: f.portions,
      created_by: userId,
      verified: false,
    })),
    { onConflict: "source,external_id", ignoreDuplicates: true },
  );
  const ids = all.map((f) => f.external_id!).filter(Boolean);
  const { data } = await supabase.from("foods").select("*").in("source", ["off", "usda"]).in("external_id", ids);
  if (data && data.length) {
    const order = new Map(ids.map((id, i) => [id, i]));
    return data.map(toFoodRow).sort((a, b) => (order.get(a.external_id ?? "") ?? 0) - (order.get(b.external_id ?? "") ?? 0));
  }
  // si no se pudo cachear, devolvemos sin id persistido
  return all.map((f, i) => ({ ...f, id: `ext-${f.source}-${f.external_id ?? i}` }));
}

/** Recientes y frecuentes del usuario (de lo que ya cargó). */
export async function recentAndFrequent(supabase: ServerClient, userId: string): Promise<{ recent: FoodRow[]; frequent: FoodRow[] }> {
  const { data } = await supabase
    .from("food_log_items")
    .select("food_id, grams, created_at")
    .eq("user_id", userId)
    .not("food_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);
  const items = data ?? [];
  const recentIds: string[] = [];
  const counts = new Map<string, number>();
  for (const it of items) {
    const id = it.food_id!;
    if (!recentIds.includes(id) && recentIds.length < 8) recentIds.push(id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const frequentIds = [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => id);
  const ids = [...new Set([...recentIds, ...frequentIds])];
  if (ids.length === 0) return { recent: [], frequent: [] };
  const { data: foods } = await supabase.from("foods").select("*").in("id", ids);
  const byId = new Map((foods ?? []).map((f) => [f.id, toFoodRow(f)]));
  return {
    recent: recentIds.map((id) => byId.get(id)).filter((f): f is FoodRow => Boolean(f)),
    frequent: frequentIds.map((id) => byId.get(id)).filter((f): f is FoodRow => Boolean(f)),
  };
}
