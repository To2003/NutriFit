import "server-only";
import { z } from "zod";
import type { ServerClient } from "@/lib/supabase/server";
import type { Me } from "@/lib/data/me";
import { loadDay } from "@/lib/data/day";
import { getAI } from "@/lib/ai/provider";
import { runAI } from "@/lib/ai/run";
import { dayContext, profileContext } from "@/lib/ai/context";
import { PROFE_PERSONA } from "@/lib/ai/prompts/persona";
import { addDays } from "@/lib/dates";
import { serverEnv } from "@/lib/env";
import { kcalFloor } from "@/lib/calc/targets";
import { violatesGuardrails } from "./guardrails";
import { fallbackDailyClose } from "./fallbacks";
import { snapshotOf } from "./feedback";
import { lowIntakeAlert, LOW_INTAKE_MESSAGE } from "./low-intake";

const schema = z.object({
  resumen: z.string().min(5).max(260),
  bien: z.string().min(3).max(200),
  ajuste: z.string().min(3).max(220),
});
export type DailyClose = z.infer<typeof schema> & { text: string; alert?: boolean };

/** Cierre del día: balance, 1 cosa que salió bien, 1 ajuste concreto para mañana. Idempotente por fecha. */
export async function generateDailyClose(supabase: ServerClient, me: Me, date: string): Promise<DailyClose | null> {
  const existing = await supabase.from("agent_messages").select("content").eq("user_id", me.userId).eq("kind", "daily_close").eq("for_date", date).maybeSingle();
  if (existing.data) return existing.data.content as unknown as DailyClose;

  const day = await loadDay(supabase, me, date);
  const snap = snapshotOf(day, 22);
  const trained = day.workouts.some((w) => w.ended_at) || day.planned.some((p) => p.status === "done") || day.extraActivities.length > 0;

  // guardrail de ingesta baja (últimos 5 días con datos)
  const past = await supabase
    .from("food_logs")
    .select("log_date, food_log_items(kcal)")
    .eq("user_id", me.userId)
    .gte("log_date", addDays(date, -4))
    .lte("log_date", date);
  const byDay = new Map<string, { meals: number; kcal: number }>();
  for (const f of past.data ?? []) {
    const d = byDay.get(f.log_date) ?? { meals: 0, kcal: 0 };
    d.meals++;
    d.kcal += (f.food_log_items ?? []).reduce((s, i) => s + Number(i.kcal), 0);
    byDay.set(f.log_date, d);
  }
  const floor = day.targets ? kcalFloor(day.targets.bmrKcal, (me.details.sex as "male" | "female") ?? "male") : 1500;
  const alert = lowIntakeAlert([...byDay.values()], floor);

  const out = await runAI({
    supabase,
    // El cupo gratis es chico: el cierre sale de las reglas salvo GEMINI_RICH=1
    enabled: serverEnv().geminiRich,
    call: async () => {
      const r = await getAI().generateJSON({
        system: `${PROFE_PERSONA}
Hacé el cierre del día: "resumen" (balance de kcal, proteína, agua y entreno vs. objetivo, en criollo), "bien" (1 cosa que salió bien) y "ajuste" (1 ajuste concreto para mañana).${alert ? "\nIMPORTANTE: la persona viene comiendo muy por debajo de lo necesario varios días. No felicites por comer poco; sugerí con tacto hablar con un profesional." : ""}`,
        prompt: JSON.stringify({ hoy: dayContext(me, day), perfil: profileContext(me), entreno_hoy: trained }),
        schema,
        temperature: 0.7,
        thinking: "low",
        timeoutMs: 25_000,
        retries: 1,
      });
      if (violatesGuardrails(`${r.resumen} ${r.bien} ${r.ajuste}`)) throw new Error("guardrail");
      return r;
    },
    fallback: () => fallbackDailyClose({ ...snap, trained }),
  });
  const data = out.data;
  const ajuste = alert ? LOW_INTAKE_MESSAGE : data.ajuste;
  const content: DailyClose = { ...data, ajuste, alert, text: `${data.resumen} ✅ ${data.bien} 👉 ${ajuste}` };
  // índice único parcial (user_id, kind, for_date): si otro proceso lo creó, se ignora el duplicado
  await supabase.from("agent_messages").insert({ user_id: me.userId, kind: "daily_close", for_date: date, content: content as never, source: out.source });
  return content;
}
