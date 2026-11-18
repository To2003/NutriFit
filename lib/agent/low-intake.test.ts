import { describe, expect, it } from "vitest";
import { lowIntakeAlert, LOW_INTAKE_MESSAGE } from "./low-intake";
import { violatesGuardrails } from "./guardrails";

describe("lowIntakeAlert", () => {
  it("3+ días completos por debajo del 80 % del piso → alerta", () => {
    const d = [1100, 1000, 1150, 2400].map((kcal) => ({ meals: 4, kcal }));
    expect(lowIntakeAlert(d, 1800)).toBe(true);
  });
  it("días incompletos no cuentan (puede ser que no cargó todo)", () => {
    const d = [500, 600, 700].map((kcal) => ({ meals: 1, kcal }));
    expect(lowIntakeAlert(d, 1800)).toBe(false);
  });
  it("2 días no alcanzan", () => {
    expect(lowIntakeAlert([{ meals: 3, kcal: 900 }, { meals: 3, kcal: 900 }], 1800)).toBe(false);
  });
  it("el mensaje respeta los guardrails", () => {
    expect(violatesGuardrails(LOW_INTAKE_MESSAGE)).toBe(false);
  });
});
