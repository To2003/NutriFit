import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import { AIUnavailableError } from "./provider";

/** Tope blando de llamadas por usuario y día (free tier). */
export const DAILY_AI_CAP = 80;

export type AIOutcome<T> = { data: T; source: "ai" | "fallback"; reason?: string };

/**
 * Corre una llamada a la IA con tope diario por usuario y fallback garantizado.
 * Nunca lanza: si la IA no responde, devuelve el fallback.
 */
export async function runAI<T>(args: {
  supabase?: ServerClient | null;
  call: () => Promise<T>;
  fallback: () => T | Promise<T>;
}): Promise<AIOutcome<T>> {
  try {
    if (args.supabase) {
      const { data: calls } = await args.supabase.rpc("bump_ai_usage", { failed: false });
      if (typeof calls === "number" && calls > DAILY_AI_CAP) {
        return { data: await args.fallback(), source: "fallback", reason: "cap" };
      }
    }
    const data = await args.call();
    return { data, source: "ai" };
  } catch (e) {
    const reason = e instanceof AIUnavailableError ? e.reason : "error";
    if (process.env.NODE_ENV !== "test") console.warn(`[ai] fallback (${reason}):`, (e as Error)?.message?.slice(0, 200));
    return { data: await args.fallback(), source: "fallback", reason };
  }
}
