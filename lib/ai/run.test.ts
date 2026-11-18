import { describe, expect, it, vi } from "vitest";
import { runAI } from "./run";

describe("runAI", () => {
  it("enabled=false → directo al fallback, sin llamar a la IA", async () => {
    const call = vi.fn(async () => "ia");
    const r = await runAI({ enabled: false, call, fallback: () => "reglas" });
    expect(r).toEqual({ data: "reglas", source: "fallback", reason: "disabled" });
    expect(call).not.toHaveBeenCalled();
  });
  it("si la IA falla, devuelve el fallback y nunca lanza", async () => {
    const r = await runAI({ call: async () => Promise.reject(new Error("boom")), fallback: () => "reglas" });
    expect(r.source).toBe("fallback");
    expect(r.data).toBe("reglas");
  });
});
