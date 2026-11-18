import "server-only";
import { serverEnv } from "@/lib/env";
import type { FoodRow } from "./types";

const TIMEOUT = 6000;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v !== "" ? Number(v) || 0 : 0);
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Open Food Facts (sin key). Prioriza productos de Argentina. */
export async function searchOFF(q: string): Promise<Omit<FoodRow, "id">[]> {
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", q);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", "12");
  url.searchParams.set("tagtype_0", "countries");
  url.searchParams.set("tag_contains_0", "contains");
  url.searchParams.set("tag_0", "argentina");
  url.searchParams.set("fields", "code,product_name,product_name_es,brands,nutriments,serving_quantity,serving_size");
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { "User-Agent": "NutriFit/1.0 (app nutricional)" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { products?: Record<string, unknown>[] };
    return (json.products ?? [])
      .map((p) => {
        const n = (p.nutriments ?? {}) as Record<string, unknown>;
        const kcal = num(n["energy-kcal_100g"]) || num(n["energy_100g"]) / 4.184;
        const name = String(p.product_name_es || p.product_name || "").trim();
        const serving = num(p.serving_quantity);
        return {
          name,
          brand: p.brands ? String(p.brands).split(",")[0].trim() : null,
          source: "off" as const,
          external_id: String(p.code ?? ""),
          kcal: r1(kcal),
          protein_g: r1(num(n.proteins_100g)),
          carbs_g: r1(num(n.carbohydrates_100g)),
          fat_g: r1(num(n.fat_100g)),
          fiber_g: r1(num(n.fiber_100g)),
          portions: [
            ...(serving > 0 ? [{ label: `1 porción (${Math.round(serving)} g)`, grams: Math.round(serving) }] : []),
            { label: "100 g", grams: 100 },
          ],
        };
      })
      .filter((f) => f.name && f.kcal > 0 && f.external_id);
  } catch {
    return [];
  }
}

/** USDA FoodData Central (key gratis). Mejor para alimentos genéricos (en inglés). */
export async function searchUSDA(q: string): Promise<Omit<FoodRow, "id">[]> {
  const key = serverEnv().usdaApiKey;
  if (!key) return [];
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("query", q);
  url.searchParams.set("pageSize", "8");
  url.searchParams.set("dataType", "Foundation,SR Legacy");
  url.searchParams.set("api_key", key);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), next: { revalidate: 86400 } });
    if (!res.ok) return [];
    const json = (await res.json()) as { foods?: { fdcId: number; description: string; foodNutrients?: { nutrientNumber?: string; value?: number }[] }[] };
    return (json.foods ?? [])
      .map((f) => {
        const get = (nr: string) => num(f.foodNutrients?.find((x) => x.nutrientNumber === nr)?.value);
        return {
          name: f.description.charAt(0) + f.description.slice(1).toLowerCase(),
          brand: "USDA",
          source: "usda" as const,
          external_id: String(f.fdcId),
          kcal: r1(get("208")),
          protein_g: r1(get("203")),
          carbs_g: r1(get("205")),
          fat_g: r1(get("204")),
          fiber_g: r1(get("291")),
          portions: [{ label: "100 g", grams: 100 }],
        };
      })
      .filter((f) => f.kcal > 0);
  } catch {
    return [];
  }
}
