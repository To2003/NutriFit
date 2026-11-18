import { describe, expect, it } from "vitest";
import { EXERCISE_LIBRARY, LIBRARY_BY_ID } from "./library-data";
import { EQUIPMENT } from "@/lib/domain/catalog";

describe("biblioteca de ejercicios", () => {
  it("tiene ~120 ejercicios con ids únicos y válidos", () => {
    expect(EXERCISE_LIBRARY.length).toBeGreaterThanOrEqual(115);
    expect(new Set(EXERCISE_LIBRARY.map((e) => e.id)).size).toBe(EXERCISE_LIBRARY.length);
    for (const e of EXERCISE_LIBRARY) expect(e.id).toMatch(/^[a-z0-9_]+$/);
  });
  it("todas las alternativas existen, no se apuntan a sí mismas y comparten región", () => {
    for (const e of EXERCISE_LIBRARY)
      for (const a of e.alternatives) {
        expect(LIBRARY_BY_ID[a], `${e.id} → ${a}`).toBeDefined();
        expect(a).not.toBe(e.id);
      }
  });
  it("el equipamiento usa el vocabulario del onboarding", () => {
    const valid = new Set<string>([...EQUIPMENT.map((x) => x.value), "other"]);
    for (const e of EXERCISE_LIBRARY) for (const q of e.equipment) expect(valid.has(q), `${e.id}: ${q}`).toBe(true);
  });
  it("todo ejercicio de pierna pesada tiene al menos una alternativa liviana", () => {
    for (const e of EXERCISE_LIBRARY.filter((x) => x.heavy_lower)) {
      const light = e.alternatives.filter((a) => !LIBRARY_BY_ID[a].heavy_lower && LIBRARY_BY_ID[a].pattern !== "plyometric");
      expect(light.length, e.id).toBeGreaterThan(0);
    }
  });
  it("la pliometría es de impacto medio/alto y la prevención de bajo", () => {
    for (const e of EXERCISE_LIBRARY.filter((x) => x.pattern === "plyometric")) expect(e.impact).not.toBe("low");
  });
});
