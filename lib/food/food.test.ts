import { describe, expect, it } from "vitest";
import { bestMatch, matchScore } from "./match";
import { roughGrams, roughParse } from "./parse-fallback";
import { itemTotals, scaleEstimate, type DraftItem } from "./types";

describe("roughParse", () => {
  it("separa ítems y cantidades", () => {
    expect(roughParse("2 empanadas de carne al horno y una coca chica")).toEqual([
      { qty: 2, unit: null, text: "empanadas de carne al horno" },
      { qty: 1, unit: null, text: "coca chica" },
    ]);
  });
  it("gramos y unidades", () => {
    expect(roughParse("200g de arroz, 1 plato de fideos")).toEqual([
      { qty: 200, unit: "g", text: "arroz" },
      { qty: 1, unit: "plato", text: "fideos" },
    ]);
  });
  it("uno y medio", () => {
    expect(roughParse("una y media milanesa")[0]).toEqual({ qty: 1.5, unit: null, text: "milanesa" });
    expect(roughParse("dos y medio tostados")[0]).toEqual({ qty: 2.5, unit: null, text: "tostados" });
  });
  it("vacío", () => {
    expect(roughParse("   ")).toEqual([]);
  });
});

describe("roughGrams", () => {
  const portions = [{ label: "1 unidad", grams: 90 }, { label: "100 g", grams: 100 }];
  it("por unidad", () => expect(roughGrams({ qty: 2, unit: null, text: "x" }, portions)).toBe(180));
  it("gramos directos", () => expect(roughGrams({ qty: 150, unit: "g", text: "x" }, portions)).toBe(150));
  it("sin porciones → 100 g", () => expect(roughGrams({ qty: 1, unit: null, text: "x" }, [])).toBe(100));
});

describe("matchScore / bestMatch", () => {
  const foods = [
    { name: "Empanada de carne al horno", aliases: ["empanada de carne"] },
    { name: "Empanada de jamón y queso", aliases: ["empanada jyq"] },
    { name: "Coca-Cola", aliases: ["coca", "gaseosa cola"] },
    { name: "Milanesa de carne frita", aliases: [] },
  ];
  it("matchea plural y sin acentos", () => {
    expect(bestMatch("empanadas de carne", foods)?.food.name).toBe("Empanada de carne al horno");
    expect(bestMatch("empanada de jamon y queso", foods)?.food.name).toBe("Empanada de jamón y queso");
  });
  it("usa alias", () => {
    expect(bestMatch("coca chica", foods)?.food.name).toBe("Coca-Cola");
  });
  it("no matchea cualquier cosa", () => {
    expect(bestMatch("sushi de salmón", foods)).toBeNull();
    expect(matchScore("", foods[0])).toBe(0);
  });
});

describe("itemTotals / scaleEstimate", () => {
  const base: DraftItem = {
    key: "a",
    foodId: null,
    name: "x",
    grams: 200,
    per100: null,
    totals: { kcal: 400, protein_g: 20, carbs_g: 50, fat_g: 10 },
    source: "ai_estimate",
    confidence: 0.6,
    portions: [],
  };
  it("con per100 calcula por gramos", () => {
    expect(itemTotals({ ...base, per100: { kcal: 250, protein_g: 10, carbs_g: 30, fat_g: 9 }, grams: 90 })).toEqual({
      kcal: 225,
      protein_g: 9,
      carbs_g: 27,
      fat_g: 8.1,
    });
  });
  it("estimado IA escala proporcional", () => {
    expect(scaleEstimate(base, 100).totals).toEqual({ kcal: 200, protein_g: 10, carbs_g: 25, fat_g: 5 });
  });
});
