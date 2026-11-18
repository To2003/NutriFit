import { describe, expect, it } from "vitest";
import { z } from "zod";
import { cleanSchema } from "./provider";
import { aiFoodParseSchema } from "./schemas/food";
import { aiRoutineSchema } from "./schemas/routine";
import { aiSuggestSchema } from "./schemas/suggest";

describe("schemas para Gemini", () => {
  it("se convierten a JSON Schema sin claves problemáticas", () => {
    for (const s of [aiFoodParseSchema, aiRoutineSchema, aiSuggestSchema]) {
      const js = JSON.stringify(cleanSchema(z.toJSONSchema(s, { target: "draft-7", unrepresentable: "any" })));
      expect(js).not.toContain("additionalProperties");
      expect(js).not.toContain("$schema");
      expect(js).toContain('"type":"object"');
    }
  });
  it("zod rechaza salidas fuera de rango (la IA nunca impone números locos)", () => {
    const bad = { items: [{ nombre: "x", cantidad: 1, unidad: "u", gramos_estimados: 100, kcal: 99999, proteina: 1, carbos: 1, grasa: 1, confianza: 0.5 }] };
    expect(aiFoodParseSchema.safeParse(bad).success).toBe(false);
  });
});
