import { describe, expect, it } from "vitest";
import { violatesGuardrails } from "./guardrails";
import { fallbackDailyClose, fallbackLogFeedback, type DaySnapshot } from "./fallbacks";

const base: DaySnapshot = { dayType: "training", hour: 13, kcal: 1200, kcalTarget: 2600, proteinG: 80, proteinTarget: 170, waterMl: 1000, waterTarget: 3500, mealsCount: 2 };

describe("guardrails", () => {
  it("bloquea compensaciones, ayunos y comentarios sobre el cuerpo", () => {
    expect(violatesGuardrails("Mañana hacé ayuno para compensar")).toBe(true);
    expect(violatesGuardrails("Salteá la cena y listo")).toBe(true);
    expect(violatesGuardrails("Salí a correr para quemar lo que comiste")).toBe(true);
    expect(violatesGuardrails("Así vas a sacar esa panza")).toBe(true);
    expect(violatesGuardrails("No pasa nada, sin culpa")).toBe(true);
  });
  it("deja pasar mensajes sanos", () => {
    expect(violatesGuardrails("Ayer hubo pizza, hoy le metemos más verde y listo")).toBe(false);
    expect(violatesGuardrails("Sumá un yogur en la merienda para llegar a la proteína")).toBe(false);
    expect(violatesGuardrails("Pesate 3 mañanas en ayunas")).toBe(false);
    expect(violatesGuardrails("Probá el ayuno intermitente")).toBe(true);
  });
});

describe("fallbacks", () => {
  it("nunca violan los guardrails", () => {
    const kinds = ["food", "water", "weight", "activity", "workout"] as const;
    const variants: DaySnapshot[] = [
      base,
      { ...base, kcal: 4000 },
      { ...base, proteinG: 170, waterMl: 4000 },
      { ...base, dayType: "match", hour: 18, kcal: 500 },
      { ...base, hour: 20, proteinG: 20 },
    ];
    for (const v of variants)
      for (const k of kinds)
        for (let seed = 0; seed < 4; seed++) expect(violatesGuardrails(fallbackLogFeedback(v, k, seed))).toBe(false);
  });
  it("día de partido con pocas kcal → sugiere carbos", () => {
    expect(fallbackLogFeedback({ ...base, dayType: "match", hour: 14, kcal: 600 }, "food")).toMatch(/carbos/);
  });
  it("cierre del día sin cargas no reta", () => {
    const r = fallbackDailyClose({ ...base, mealsCount: 0, kcal: 0, trained: false });
    expect(r.resumen).toMatch(/sin drama/);
    expect(violatesGuardrails(`${r.resumen} ${r.bien} ${r.ajuste}`)).toBe(false);
  });
});
