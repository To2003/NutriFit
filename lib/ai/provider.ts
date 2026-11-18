import "server-only";
import { GoogleGenAI, ApiError, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { serverEnv } from "@/lib/env";

export class AIUnavailableError extends Error {
  constructor(
    message: string,
    public readonly reason: "no_key" | "quota" | "timeout" | "invalid_output" | "error",
  ) {
    super(message);
  }
}

export interface ImageInput {
  mimeType: string;
  /** base64 sin prefijo data: */
  data: string;
}

/** Cuánto "piensa" el modelo antes de responder: menos = más rápido. */
export type Thinking = "minimal" | "low" | "medium" | "high";

export interface CallOptions {
  temperature?: number;
  thinking?: Thinking;
  /** Tiempo máximo por intento. */
  timeoutMs?: number;
  /** Reintentos ante errores temporales (503/429/timeout). */
  retries?: number;
  /**
   * "quality" (default): primero el modelo principal (Gemini). "volume": primero los Gemma, que tienen
   * un cupo gratis mucho más grande; para tareas frecuentes y livianas (feedback, cierre del día).
   */
  prefer?: "quality" | "volume";
}

export interface AIProvider {
  readonly name: string;
  generateText(opts: { system: string; prompt: string } & CallOptions): Promise<string>;
  generateJSON<T>(opts: { system: string; prompt: string; schema: z.ZodType<T>; image?: ImageInput } & CallOptions): Promise<T>;
  analyzeImage<T>(opts: { system: string; prompt: string; schema: z.ZodType<T>; image: ImageInput } & CallOptions): Promise<T>;
}

const TIMEOUT_MS = 30_000;
const RETRIES = 2;
const THINKING: Record<Thinking, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};
/** Si el modelo no acepta thinkingLevel, dejamos de mandarlo (por instancia). */
let thinkingSupported = true;
const isTransient = (status: number) => status === 500 || status === 503 || status === 504;

/** Modelos sin cupo hoy (429): no se vuelven a probar hasta mañana (por instancia del server). */
const exhausted = new Map<string, string>();
const today = () => new Date().toISOString().slice(0, 10);
function isExhausted(model: string): boolean {
  return exhausted.get(model) === today();
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Concurrencia limitada por instancia: cola simple para no reventar el rate limit del free tier. */
let active = 0;
const waiters: (() => void)[] = [];
async function withSlot<T>(fn: () => Promise<T>, max = 3): Promise<T> {
  if (active >= max) await new Promise<void>((r) => waiters.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiters.shift()?.();
  }
}

/** Saca claves que algunas versiones de Gemini no aceptan; la validación estricta la hace zod después. */
export function cleanSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(cleanSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "$schema" || k === "additionalProperties" || k === "$id") continue;
    out[k] = cleanSchema(v);
  }
  return out;
}

function toJsonSchema(schema: z.ZodType): unknown {
  return cleanSchema(z.toJSONSchema(schema, { target: "draft-7", unrepresentable: "any" }));
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // modelos sin modo JSON (Gemma) a veces agregan texto antes/después
    const a = trimmed.indexOf("{");
    const b = trimmed.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(trimmed.slice(a, b + 1));
    throw new Error("sin JSON");
  }
}

/** Gemma (modelos abiertos): sin instrucciones de sistema, sin modo JSON ni thinkingLevel. */
export const isGemma = (model: string) => /^gemma/i.test(model);

type CallBody = { system: string; prompt: string; image?: ImageInput; jsonSchema?: unknown } & CallOptions;

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  private client: GoogleGenAI;

  constructor(
    apiKey: string,
    private model: string,
    private fallbackModels: string[] = [],
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  private async attempt(model: string, opts: CallBody, timeoutMs: number): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const gemma = isGemma(model);
      const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [];
      if (opts.image) parts.push({ inlineData: { mimeType: opts.image.mimeType, data: opts.image.data } });
      parts.push({
        text: gemma
          ? `${opts.system}\n\n${opts.prompt}${
              opts.jsonSchema
                ? `\n\nRespondé SOLO con un objeto JSON válido (sin texto extra ni bloques de código) que cumpla este JSON Schema:\n${JSON.stringify(opts.jsonSchema)}`
                : ""
            }`
          : opts.prompt,
      });
      const res = await withSlot(() =>
        this.client.models.generateContent({
          model,
          contents: [{ role: "user", parts }],
          config: gemma
            ? { temperature: opts.temperature ?? 0.4, abortSignal: controller.signal }
            : {
                systemInstruction: opts.system,
                temperature: opts.temperature ?? 0.4,
                abortSignal: controller.signal,
                ...(thinkingSupported && opts.thinking ? { thinkingConfig: { thinkingLevel: THINKING[opts.thinking] } } : {}),
                ...(opts.jsonSchema ? { responseMimeType: "application/json", responseJsonSchema: opts.jsonSchema } : {}),
              },
        }),
      );
      const text = res.text;
      if (!text) throw new AIUnavailableError("Respuesta vacía", "invalid_output");
      return text;
    } catch (e) {
      if (controller.signal.aborted) throw new AIUnavailableError(`Timeout (${timeoutMs} ms)`, "timeout");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  private async call(opts: CallBody): Promise<string> {
    const retries = opts.retries ?? RETRIES;
    const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
    let all = [...new Set([this.model, ...this.fallbackModels])];
    if (opts.prefer === "volume") all = [...all.filter(isGemma), ...all.filter((m) => !isGemma(m))];
    const models = all.filter((m) => !isExhausted(m));
    let lastErr: unknown = new AIUnavailableError("Todos los modelos sin cupo por hoy", "quota");
    for (const model of models) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await this.attempt(model, opts, timeoutMs);
        } catch (e) {
          lastErr = e;
          const status = e instanceof ApiError ? e.status : 0;
          const msg = String((e as Error)?.message ?? "");
          // Modelo que no acepta thinkingLevel: reintento inmediato sin esa opción
          if (status === 400 && /thinking/i.test(msg) && thinkingSupported && opts.thinking && !isGemma(model)) {
            thinkingSupported = false;
            attempt--;
            continue;
          }
          // 429 = sin cupo (por minuto o por día): no se reintenta, se pasa al siguiente modelo
          if (status === 429) {
            if (/per.?day|PerDay|daily|RPD/i.test(msg) || attempt === retries) exhausted.set(model, today());
            break;
          }
          const transient = isTransient(status) || (e instanceof AIUnavailableError && e.reason === "timeout");
          if (!transient) break; // 400/401/403/404: no tiene sentido reintentar este modelo
          if (attempt < retries) await sleep((status === 503 ? 1500 : 500) * 2 ** attempt + Math.random() * 300);
        }
      }
      // si el modelo está caído, saturado, sin cupo o no existe, probamos el siguiente
    }
    if (lastErr instanceof AIUnavailableError) throw lastErr;
    const status = lastErr instanceof ApiError ? lastErr.status : 0;
    throw new AIUnavailableError(String((lastErr as Error)?.message ?? lastErr), status === 429 || status === 503 ? "quota" : "error");
  }

  async generateText(opts: { system: string; prompt: string } & CallOptions) {
    return this.call(opts);
  }

  async generateJSON<T>(opts: { system: string; prompt: string; schema: z.ZodType<T>; image?: ImageInput } & CallOptions) {
    const text = await this.call({ ...opts, jsonSchema: toJsonSchema(opts.schema) });
    let raw: unknown;
    try {
      raw = extractJson(text);
    } catch {
      throw new AIUnavailableError("JSON inválido", "invalid_output");
    }
    const parsed = opts.schema.safeParse(raw);
    if (!parsed.success) throw new AIUnavailableError(`Salida fuera de schema: ${parsed.error.message.slice(0, 200)}`, "invalid_output");
    return parsed.data;
  }

  async analyzeImage<T>(opts: { system: string; prompt: string; schema: z.ZodType<T>; image: ImageInput } & CallOptions) {
    return this.generateJSON({ temperature: 0.2, thinking: "low", timeoutMs: 40_000, retries: 1, ...opts });
  }
}

/** Proveedor sin IA: siempre falla, para forzar fallbacks (tests o sin key). */
class NullProvider implements AIProvider {
  readonly name = "none";
  async generateText(): Promise<string> {
    throw new AIUnavailableError("IA no configurada", "no_key");
  }
  async generateJSON<T>(): Promise<T> {
    throw new AIUnavailableError("IA no configurada", "no_key");
  }
  async analyzeImage<T>(): Promise<T> {
    throw new AIUnavailableError("IA no configurada", "no_key");
  }
}

let provider: AIProvider | null = null;

export function getAI(): AIProvider {
  if (provider) return provider;
  const env = serverEnv();
  provider = env.geminiApiKey ? new GeminiProvider(env.geminiApiKey, env.geminiModel, env.geminiFallbackModels) : new NullProvider();
  return provider;
}

/** Para tests. */
export function setAI(p: AIProvider | null) {
  provider = p;
}

/** Solo tests: vuelve a habilitar thinkingLevel y limpia los modelos sin cupo. */
export function __resetThinkingSupport() {
  thinkingSupported = true;
  exhausted.clear();
}
