import "server-only";
import { GoogleGenAI, ApiError } from "@google/genai";
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

export interface AIProvider {
  readonly name: string;
  generateText(opts: { system: string; prompt: string; temperature?: number }): Promise<string>;
  generateJSON<T>(opts: { system: string; prompt: string; schema: z.ZodType<T>; temperature?: number; image?: ImageInput }): Promise<T>;
  analyzeImage<T>(opts: { system: string; prompt: string; schema: z.ZodType<T>; image: ImageInput }): Promise<T>;
}

const TIMEOUT_MS = 25_000;
const RETRIES = 2;
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

function toJsonSchema(schema: z.ZodType): unknown {
  const js = z.toJSONSchema(schema, { target: "draft-7", unrepresentable: "any" }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  return JSON.parse(trimmed);
}

class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  private client: GoogleGenAI;
  constructor(
    apiKey: string,
    private model: string,
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  private async call(opts: {
    system: string;
    prompt: string;
    temperature?: number;
    image?: ImageInput;
    jsonSchema?: unknown;
  }): Promise<string> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [];
        if (opts.image) parts.push({ inlineData: { mimeType: opts.image.mimeType, data: opts.image.data } });
        parts.push({ text: opts.prompt });
        const res = await withSlot(() =>
          this.client.models.generateContent({
            model: this.model,
            contents: [{ role: "user", parts }],
            config: {
              systemInstruction: opts.system,
              temperature: opts.temperature ?? 0.4,
              abortSignal: controller.signal,
              ...(opts.jsonSchema ? { responseMimeType: "application/json", responseJsonSchema: opts.jsonSchema } : {}),
            },
          }),
        );
        const text = res.text;
        if (!text) throw new AIUnavailableError("Respuesta vacía", "invalid_output");
        return text;
      } catch (e) {
        lastErr = e;
        const status = e instanceof ApiError ? e.status : 0;
        if (controller.signal.aborted) lastErr = new AIUnavailableError("Timeout", "timeout");
        // No reintentar errores del cliente (salvo 429)
        if (status && status < 500 && status !== 429) break;
        if (status === 429 && attempt === RETRIES) break;
        if (attempt < RETRIES) await sleep(600 * 2 ** attempt + Math.random() * 300);
      } finally {
        clearTimeout(timer);
      }
    }
    if (lastErr instanceof AIUnavailableError) throw lastErr;
    const status = lastErr instanceof ApiError ? lastErr.status : 0;
    throw new AIUnavailableError(String((lastErr as Error)?.message ?? lastErr), status === 429 ? "quota" : "error");
  }

  async generateText(opts: { system: string; prompt: string; temperature?: number }) {
    return this.call(opts);
  }

  async generateJSON<T>(opts: { system: string; prompt: string; schema: z.ZodType<T>; temperature?: number; image?: ImageInput }) {
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

  async analyzeImage<T>(opts: { system: string; prompt: string; schema: z.ZodType<T>; image: ImageInput }) {
    return this.generateJSON({ ...opts, temperature: 0.2 });
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
  provider = env.geminiApiKey ? new GeminiProvider(env.geminiApiKey, env.geminiModel) : new NullProvider();
  return provider;
}

/** Para tests. */
export function setAI(p: AIProvider | null) {
  provider = p;
}
