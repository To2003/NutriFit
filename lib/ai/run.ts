import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import { AIUnavailableError } from "./provider";

import { serverEnv } from "@/lib/env";
import { quotaBlock, type QuotaUsage } from "./quota";

export type AIOutcome<T> = { data: T; source: "ai" | "fallback"; reason?: string };

/**
 * Corre una llamada a la IA con tope diario por usuario y fallback garantizado.
 * Nunca lanza: si la IA no responde, devuelve el fallback.
 */
export async function runAI<T>(args: {
  supabase?: ServerClient | null;
  /** Para crons (service role): a nombre de quién se cuenta la llamada. */
  userId?: string;
  call: () => Promise<T>;
  fallback: () => T | Promise<T>;
  /** false = directo a las reglas, sin gastar cupo ni loguear. */
  enabled?: boolean;
}): Promise<AIOutcome<T>> {
  if (args.enabled === false) return { data: await args.fallback(), source: "fallback", reason: "disabled" };
  try {
    if (args.supabase) {
      const { data } = await args.supabase.rpc("consume_ai_quota", { p_user: args.userId ?? undefined });
      const env = serverEnv();
      const block = quotaBlock(data as QuotaUsage | null, {
        dailyPerUser: env.aiDailyCapPerUser,
        monthlyPerUser: env.aiMonthlyCapPerUser,
        dailyGlobal: env.aiDailyCapGlobal,
      });
      if (block) return { data: await args.fallback(), source: "fallback", reason: block };
    }
    const data = await args.call();
    return { data, source: "ai" };
  } catch (e) {
    const reason = e instanceof AIUnavailableError ? e.reason : "error";
    if (process.env.NODE_ENV !== "test") console.warn(`[ai] fallback (${reason}):`, (e as Error)?.message?.slice(0, 200));
    return { data: await args.fallback(), source: "fallback", reason };
  }
}
