export interface FoodRow {
  id: string;
  name: string;
  brand: string | null;
  source: "local" | "off" | "usda" | "custom";
  external_id?: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number | null;
  portions: { label: string; grams: number }[];
  aliases?: string[];
  verified?: boolean;
}

/** Ítem en la pantalla de confirmación (antes de guardar). */
export interface DraftItem {
  key: string;
  foodId: string | null;
  name: string;
  grams: number;
  /** valores por 100 g (si viene de la base) */
  per100: { kcal: number; protein_g: number; carbs_g: number; fat_g: number } | null;
  /** totales estimados por la IA (si no matcheó) */
  totals: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
  source: "local" | "off" | "usda" | "custom" | "ai_estimate";
  confidence: number | null;
  portions: { label: string; grams: number }[];
}

export function itemTotals(it: Pick<DraftItem, "grams" | "per100" | "totals">) {
  if (it.per100) {
    const f = it.grams / 100;
    return {
      kcal: Math.round(it.per100.kcal * f),
      protein_g: Math.round(it.per100.protein_g * f * 10) / 10,
      carbs_g: Math.round(it.per100.carbs_g * f * 10) / 10,
      fat_g: Math.round(it.per100.fat_g * f * 10) / 10,
    };
  }
  return it.totals;
}

/** Al cambiar gramos de un ítem estimado por IA, se escala proporcionalmente. */
export function scaleEstimate(it: DraftItem, newGrams: number): DraftItem {
  if (it.per100 || it.grams <= 0) return { ...it, grams: newGrams };
  const f = newGrams / it.grams;
  return {
    ...it,
    grams: newGrams,
    totals: {
      kcal: Math.round(it.totals.kcal * f),
      protein_g: Math.round(it.totals.protein_g * f * 10) / 10,
      carbs_g: Math.round(it.totals.carbs_g * f * 10) / 10,
      fat_g: Math.round(it.totals.fat_g * f * 10) / 10,
    },
  };
}
