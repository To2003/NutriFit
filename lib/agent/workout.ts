import "server-only";
import { z } from "zod";
import type { ServerClient } from "@/lib/supabase/server";
import { getAI } from "@/lib/ai/provider";
import { runAI } from "@/lib/ai/run";
import { PROFE_PERSONA } from "@/lib/ai/prompts/persona";
import { violatesGuardrails } from "./guardrails";
import { serverEnv } from "@/lib/env";

const schema = z.object({ mensaje: z.string().min(3).max(300) });

export interface WorkoutSummary {
  sessionName: string;
  durationMin: number;
  volumeKg: number;
  feeling: number | null;
  prs: { exercise: string; e1rm: number }[];
  pain: { zone: string; intensity: number }[];
  isDeload: boolean;
}

export function fallbackWorkoutFeedback(s: WorkoutSummary): string {
  if (s.pain.length) return "Anotada la molestia. Si sigue o duele más, consultalo con un profesional. Ya ajusté lo que carga esa zona.";
  if (s.prs.length) return `¡Récord en ${s.prs[0].exercise}! 📈 Comé bien hoy y dormí: ahí se consolida.`;
  if (s.isDeload) return "Semana de descarga cumplida: menos es más. El cuerpo asimila y volvés con todo.";
  if (s.feeling !== null && s.feeling <= 4) return "Día pesado, pero lo hiciste igual. Eso suma. Priorizá dormir bien hoy.";
  return "Sesión adentro 💪 Proteína en la próxima comida y agua, que el cuerpo lo pide.";
}

export async function workoutFeedback(supabase: ServerClient, userId: string, date: string, s: WorkoutSummary, ref: string): Promise<string> {
  const out = await runAI({
    supabase,
    enabled: serverEnv().geminiRich,
    call: async () => {
      const r = await getAI().generateJSON({
        system: `${PROFE_PERSONA}\nComentá la sesión de gimnasio en 1–2 oraciones: celebrá lo bueno y dejá un tip de recuperación.`,
        prompt: JSON.stringify({
          sesion: s.sessionName,
          duracion_min: s.durationMin,
          volumen_kg: Math.round(s.volumeKg),
          sensacion_1a10: s.feeling,
          records: s.prs.map((p) => `${p.exercise}: 1RM estimado ${p.e1rm.toFixed(1)} kg`),
          molestias: s.pain.map((p) => `${p.zone} ${p.intensity}/10`),
          semana_de_descarga: s.isDeload,
        }),
        schema,
        temperature: 0.7,
        thinking: "minimal",
        timeoutMs: 9_000,
        retries: 0,
      });
      if (violatesGuardrails(r.mensaje)) throw new Error("guardrail");
      // dolor → siempre derivar
      if (s.pain.length && !/profesional|kinesi|m[eé]dic|deport[oó]log/i.test(r.mensaje)) {
        return { mensaje: `${r.mensaje} Si la molestia sigue, consultalo con un profesional.` };
      }
      return r;
    },
    fallback: () => ({ mensaje: fallbackWorkoutFeedback(s) }),
  });
  await supabase.from("agent_messages").insert({
    user_id: userId,
    kind: s.pain.length ? "pain" : "workout_feedback",
    for_date: date,
    content: { text: out.data.mensaje, prs: s.prs, pain: s.pain },
    ref,
    source: out.source,
  });
  return out.data.mensaje;
}
