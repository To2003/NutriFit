import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@google/genai";
import { z } from "zod";
import { AIUnavailableError, GeminiProvider, __resetThinkingSupport, extractJson } from "./provider";

type Req = {
  model: string;
  contents: { parts: { text?: string }[] }[];
  config: { thinkingConfig?: unknown; abortSignal?: AbortSignal; systemInstruction?: unknown; responseMimeType?: string };
};
const ok = (text: string) => ({ text });
const apiErr = (status: number, message: string) => new ApiError({ status, message });

function provider(fn: (req: Req) => Promise<{ text: string }>, fallback: string[] = []) {
  const p = new GeminiProvider("test", "main-model", fallback);
  const generateContent = vi.fn(fn);
  (p as unknown as { client: unknown }).client = { models: { generateContent } };
  return { p, generateContent };
}

const schema = z.object({ mensaje: z.string() });

describe("GeminiProvider: reintentos y respaldo", () => {
  beforeEach(() => __resetThinkingSupport());

  it("503 (saturado) → reintenta y responde", async () => {
    let n = 0;
    const { p, generateContent } = provider(async () => (n++ === 0 ? Promise.reject(apiErr(503, "high demand")) : ok('{"mensaje":"hola"}')));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const r = await p.generateJSON({ system: "s", prompt: "p", schema, retries: 1 });
    vi.useRealTimers();
    expect(r.mensaje).toBe("hola");
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("modelo que no acepta thinkingLevel → sigue sin esa opción", async () => {
    const { p, generateContent } = provider(async (req) =>
      req.config.thinkingConfig ? Promise.reject(apiErr(400, "thinking_level is not supported for this model")) : ok('{"mensaje":"ok"}'),
    );
    const r = await p.generateJSON({ system: "s", prompt: "p", schema, thinking: "low", retries: 0 });
    expect(r.mensaje).toBe("ok");
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("404 en el modelo principal → usa el de respaldo", async () => {
    const { p, generateContent } = provider(
      async (req) => (req.model === "main-model" ? Promise.reject(apiErr(404, "model not found")) : ok('{"mensaje":"respaldo"}')),
      ["backup-model"],
    );
    const r = await p.generateJSON({ system: "s", prompt: "p", schema, retries: 1 });
    expect(r.mensaje).toBe("respaldo");
    expect(generateContent.mock.calls.map((c) => c[0].model)).toEqual(["main-model", "backup-model"]);
  });

  it("429 (sin cupo) → pasa al siguiente modelo sin reintentar y no lo vuelve a probar hoy", async () => {
    const { p, generateContent } = provider(
      async (req) => (req.model === "main-model" ? Promise.reject(apiErr(429, "Quota exceeded: GenerateRequestsPerDayPerProjectPerModel")) : ok('{"mensaje":"otro"}')),
      ["backup-model"],
    );
    expect((await p.generateJSON({ system: "s", prompt: "p", schema, retries: 2 })).mensaje).toBe("otro");
    expect((await p.generateJSON({ system: "s", prompt: "p", schema, retries: 2 })).mensaje).toBe("otro");
    expect(generateContent.mock.calls.map((c) => c[0].model)).toEqual(["main-model", "backup-model", "backup-model"]);
  });

  it("todos los modelos sin cupo → error 'quota' (la app usa el fallback)", async () => {
    const { p } = provider(async () => Promise.reject(apiErr(429, "per day quota")), ["backup-model"]);
    await expect(p.generateJSON({ system: "s", prompt: "p", schema })).rejects.toMatchObject({ reason: "quota" });
    await expect(p.generateJSON({ system: "s", prompt: "p", schema })).rejects.toMatchObject({ reason: "quota" });
  });

  it("400 genérico no se reintenta y sin respaldo falla con error", async () => {
    const { p, generateContent } = provider(async () => Promise.reject(apiErr(400, "bad request")));
    await expect(p.generateJSON({ system: "s", prompt: "p", schema, retries: 2 })).rejects.toBeInstanceOf(AIUnavailableError);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("tarda demasiado → timeout (la app usa el fallback)", async () => {
    const { p } = provider(
      (req) =>
        new Promise((_, reject) => {
          req.config.abortSignal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    await expect(p.generateJSON({ system: "s", prompt: "p", schema, timeoutMs: 30, retries: 0 })).rejects.toMatchObject({ reason: "timeout" });
  });
});

describe("Gemma (cupo grande, sin modo JSON)", () => {
  beforeEach(() => __resetThinkingSupport());

  it("manda instrucciones y schema dentro del prompt, sin systemInstruction/JSON mode/thinking", async () => {
    const { p, generateContent } = provider(async () => ok('Acá va:\n```json\n{"mensaje":"de gemma"}\n```'));
    (p as unknown as { model: string }).model = "gemma-4-31b-it";
    const r = await p.generateJSON({ system: "Sos el Profe", prompt: "hola", schema, thinking: "low" });
    expect(r.mensaje).toBe("de gemma");
    const req = generateContent.mock.calls[0][0];
    expect(req.config.systemInstruction).toBeUndefined();
    expect(req.config.responseMimeType).toBeUndefined();
    expect(req.config.thinkingConfig).toBeUndefined();
    const text = req.contents[0].parts.at(-1)!.text!;
    expect(text).toContain("Sos el Profe");
    expect(text).toContain("JSON Schema");
  });

  it('prefer: "volume" prueba Gemma primero', async () => {
    const { p, generateContent } = provider(async () => ok('{"mensaje":"x"}'), ["gemma-4-31b-it", "backup-model"]);
    await p.generateJSON({ system: "s", prompt: "p", schema, prefer: "volume" });
    expect(generateContent.mock.calls[0][0].model).toBe("gemma-4-31b-it");
    await p.generateJSON({ system: "s", prompt: "p", schema });
    expect(generateContent.mock.calls[1][0].model).toBe("main-model");
  });

  it("extractJson tolera texto alrededor y bloques de código", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Claro! {"a":2} espero que sirva')).toEqual({ a: 2 });
    expect(() => extractJson("nada de json")).toThrow();
  });
});
