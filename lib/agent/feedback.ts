import "server-only";
import { z } from "zod";
import type { ServerClient } from "@/lib/supabase/server";
import { loadMe } from "@/lib/data/me";
import { loadDay, type DaySummary } from "@/lib/data/day";
import { getAI } from "@/lib/ai/provider";
import { runAI } from "@/lib/ai/run";
import { dayContext } from "@/lib/ai/context";
import { PROFE_PERSONA } from "@/lib/ai/prompts/persona";
import { timeInTz } from "@/lib/dates";
import { serverEnv } from "@/lib/env";
import { violatesGuardrails } from "./guardrails";
import { fallbackLogFeedback, type DaySnapshot } from "./fallbacks";

export type LogKind = "food" | "water" | "weight" | "activity" | "workout";

const feedbackSchema = z.object({ mensaje: z.string().min(3).max(260) });

export function snapshotOf(day: DaySummary, hour: number): DaySnapshot {
  return {
    dayType: day.targets?.dayType ?? "rest",
    hour,
    kcal: day.totals.kcal,
    kcalTarget: day.targets?.kcal ?? 2000,
    proteinG: day.totals.protein_g,
    proteinTarget: day.targets?.proteinG ?? 120,
    waterMl: day.waterMl,
    waterTarget: day.targets?.waterMl ?? 2500,
    mealsCount: day.meals.length,
  };
}

const KIND_LABEL: Record<LogKind, string> = {
  food: "cargó una comida",
  water: "sumó agua",
  weight: "registró su peso",
  activity: "registró una actividad",
  workout: "terminó una sesión de gimnasio",
};

/**
 * Feedback corto del Profe después de cargar algo. Se guarda en agent_messages.
 * El agua no llama a la IA (es muy frecuente): usa reglas.
 */
export async function feedbackAfterLog(
  supabase: ServerClient,
  userId: string,
  args: { kind: LogKind; date: string; ref?: string; extra?: string },
): Promise<string | null> {
  try {
    const me = await loadMe(supabase, userId);
    if (!me) return null;
    const day = await loadDay(supabase, me, args.date);
    const hour = Number(timeInTz(me.tz).slice(0, 2));
    const snap = snapshotOf(day, hour);
    const fallback = () => ({ mensaje: fallbackLogFeedback(snap, args.kind) });

    const out =
      // El cupo gratis de Gemini es chico: el feedback por carga sale de las reglas salvo GEMINI_RICH=1
      args.kind === "water" || args.kind === "weight" || !serverEnv().geminiRich
        ? { data: fallback(), source: "fallback" as const }
        : await runAI({
            supabase,
            call: async () => {
              const r = await getAI().generateJSON({
                system: `${PROFE_PERSONA}\nRespondé con 1 o 2 oraciones (máx. 220 caracteres): cómo viene el día y un tip concreto.`,
                prompt: `La persona ${KIND_LABEL[args.kind]}.${args.extra ? ` Detalle: ${args.extra}.` : ""}\nContexto del día (JSON):\n${JSON.stringify(dayContext(me, day))}`,
                schema: feedbackSchema,
                temperature: 0.7,
                // el usuario está esperando que se guarde: rápido o fallback
                prefer: "volume",
                thinking: "minimal",
                timeoutMs: 9_000,
                retries: 0,
              });
              if (violatesGuardrails(r.mensaje)) throw new Error("guardrail");
              return r;
            },
            fallback,
          });

    await supabase.from("agent_messages").insert({
      user_id: userId,
      kind: "log_feedback",
      for_date: args.date,
      content: { text: out.data.mensaje, log_kind: args.kind },
      ref: args.ref ?? null,
      source: out.source,
    });
    return out.data.mensaje;
  } catch {
    return null;
  }
}
