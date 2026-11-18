import { createClient } from "@/lib/supabase/server";
import type { Me } from "@/lib/data/me";
import { addDays, weekStart } from "@/lib/dates";
import { fmt, fmt1 } from "@/lib/utils";
import { Section } from "./section";

export async function PerformanceCard({ me }: { me: Me }) {
  const supabase = await createClient();
  const ws = weekStart(me.today);
  const [vol, prs, tests] = await Promise.all([
    supabase.from("workout_sessions").select("log_date, volume_kg").eq("user_id", me.userId).gte("log_date", addDays(ws, -7)).not("ended_at", "is", null),
    supabase.from("agent_messages").select("content, for_date").eq("user_id", me.userId).eq("kind", "workout_feedback").order("created_at", { ascending: false }).limit(10),
    supabase.from("fitness_tests").select("log_date, value").eq("user_id", me.userId).eq("test", "cmj").order("log_date", { ascending: false }).limit(2),
  ]);
  const thisWeek = (vol.data ?? []).filter((v) => v.log_date >= ws).reduce((s, v) => s + Number(v.volume_kg ?? 0), 0);
  const lastWeek = (vol.data ?? []).filter((v) => v.log_date < ws).reduce((s, v) => s + Number(v.volume_kg ?? 0), 0);
  const lastPrs = (prs.data ?? []).flatMap((m) => ((m.content as { prs?: { exercise: string; e1rm: number }[] })?.prs ?? []).map((p) => ({ ...p, date: m.for_date }))).slice(0, 3);
  const [cmj, prevCmj] = tests.data ?? [];
  if (!thisWeek && !lastWeek && !lastPrs.length && !cmj) return null;
  return (
    <Section title="Gym y rendimiento" href="/perfil/progreso" linkLabel="Tests">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[14px] bg-surface-2 p-3">
          <p className="text-xs text-muted">Volumen semanal</p>
          <p className="score text-2xl">
            {fmt(thisWeek)}
            <span className="font-sans text-sm font-normal text-muted"> kg</span>
          </p>
          {lastWeek ? <p className="text-xs text-muted">semana pasada {fmt(lastWeek)}</p> : null}
        </div>
        <div className="rounded-[14px] bg-surface-2 p-3">
          <p className="text-xs text-muted">Salto (CMJ)</p>
          <p className="score text-2xl">
            {cmj ? fmt1(Number(cmj.value)) : "—"}
            <span className="font-sans text-sm font-normal text-muted"> cm</span>
          </p>
          {cmj && prevCmj ? (
            <p className={`text-xs ${Number(cmj.value) >= Number(prevCmj.value) ? "text-accent" : "text-muted"}`}>
              {Number(cmj.value) >= Number(prevCmj.value) ? "+" : ""}
              {fmt1(Number(cmj.value) - Number(prevCmj.value))} cm vs. anterior
            </p>
          ) : (
            <p className="text-xs text-muted">hacé el test cada 4 semanas</p>
          )}
        </div>
      </div>
      {lastPrs.length ? (
        <ul className="mt-3 space-y-1 text-sm">
          {lastPrs.map((p, i) => (
            <li key={i} className="tnum flex justify-between">
              <span>📈 {p.exercise}</span>
              <span className="text-muted">{fmt1(p.e1rm)} kg</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}
