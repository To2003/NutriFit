import { normalize } from "@/lib/text";

/** Parser sin IA: "2 empanadas de carne y una coca chica" → [{qty: 2, text: "empanadas de carne"}, {qty: 1, text: "coca chica"}]. */
export interface RoughItem {
  qty: number;
  unit: string | null;
  text: string;
}

const WORD_NUM: Record<string, number> = {
  un: 1, una: 1, uno: 1, medio: 0.5, media: 0.5, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  par: 2, docena: 12,
};
const UNITS = ["g", "gr", "grs", "gramos", "kg", "ml", "cc", "l", "litro", "litros", "porcion", "porciones", "plato", "platos", "vaso", "vasos", "taza", "tazas", "rebanada", "rebanadas", "feta", "fetas", "cucharada", "cucharadas", "lata", "latas", "unidad", "unidades"];

export function roughParse(input: string): RoughItem[] {
  const parts = input
    .toLowerCase()
    .replace(/\s+y\s+medi[oa]\b/g, " ymedio")
    .split(/[,;+\n]|\s+y\s+|\s+m[aá]s\s+|\s+con\s+(?=(?:un|una|dos|tres|\d))/)
    .map((p) => normalize(p))
    .filter(Boolean);
  return parts.map((p) => {
    const words = p.split(" ");
    let qty = 1;
    let unit: string | null = null;
    let i = 0;
    const m = words[0]?.match(/^(\d+(?:[.,]\d+)?)(g|gr|ml|cc|kg)?$/);
    if (m) {
      qty = Number(m[1].replace(",", "."));
      if (m[2]) unit = m[2];
      i = 1;
    } else if (words[0] && words[0] in WORD_NUM) {
      qty = WORD_NUM[words[0]];
      i = 1;
      if (words[1] === "ymedio") {
        qty += 0.5;
        i = 2;
      }
    }
    if (!unit && words[i] && UNITS.includes(words[i])) {
      unit = words[i];
      i++;
    }
    if (unit && words[i] === "de") i++;
    return { qty, unit, text: words.slice(i).join(" ").trim() };
  }).filter((r) => r.text.length > 0);
}

/** Gramos para un ítem rough dada la porción típica del alimento. */
export function roughGrams(item: RoughItem, portions: { label: string; grams: number }[]): number {
  const u = item.unit;
  if (u && ["g", "gr", "grs", "gramos", "ml", "cc"].includes(u)) return item.qty;
  if (u === "kg" || u === "l" || u === "litro" || u === "litros") return item.qty * 1000;
  const unitPortion =
    portions.find((p) => u && normalize(p.label).includes(u.replace(/s$/, ""))) ??
    portions.find((p) => /unidad|porcion|plato|vaso|lata/.test(normalize(p.label))) ??
    portions[0];
  return Math.round((unitPortion?.grams ?? 100) * item.qty);
}
