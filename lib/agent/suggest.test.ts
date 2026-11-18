import { describe, expect, it } from "vitest";
import { fallbackIdeas } from "./suggest-fallback";

const base = {
  meal: "dinner",
  diet: "omnivore" as const,
  dislikes: [],
  allergies: "",
  cookingTime: "normal" as const,
  pantry: "",
  remaining: { kcal: 800, protein: 50 },
  mealsLeft: 1,
};

describe("fallbackIdeas", () => {
  it("devuelve 3 ideas con macros calculados desde la base local", () => {
    const r = fallbackIdeas(base);
    expect(r).toHaveLength(3);
    for (const i of r) {
      expect(i.kcal).toBeGreaterThan(0);
      expect(i.ingredientes.length).toBeGreaterThan(0);
    }
  });
  it("vegano no recibe carne ni lácteos", () => {
    for (const i of fallbackIdeas({ ...base, diet: "vegan" })) expect(i.ingredientes.some((x) => /pollo|carne|merluza|atún|huevo|leche|yogur|queso|ricota/i.test(x.nombre))).toBe(false);
  });
  it("respeta lo que no le gusta", () => {
    for (const i of fallbackIdeas({ ...base, dislikes: ["arroz", "pollo"] })) expect(i.ingredientes.some((x) => /arroz|pollo/i.test(x.nombre))).toBe(false);
  });
  it("prioriza lo que hay en casa", () => {
    const r = fallbackIdeas({ ...base, pantry: "tengo atún y fideos" });
    expect(r[0].nombre).toMatch(/atún/i);
  });
  it("poco tiempo → recetas rápidas", () => {
    expect(fallbackIdeas({ ...base, cookingTime: "low" }).every((i) => i.tiempo_min <= 15)).toBe(true);
  });
});
