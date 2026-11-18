import { requireMe } from "@/lib/data/me";
import { createClient } from "@/lib/supabase/server";
import { getActiveProgram } from "@/lib/data/training";
import { LIBRARY_BY_ID } from "@/lib/training/library-data";
import { isoWeekday, formatDayShort } from "@/lib/dates";
import { ProgramView, type ViewSession } from "@/components/training/program-view";
import { GenerateButton } from "@/components/training/generate-button";
import { ProfeBubble } from "@/components/ui/profe";
import { Empty } from "@/components/ui/empty";
import { fmt } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Entreno" };

export default async function EntrenoPage() {
  const me = await requireMe();
  const supabase = await createClient();
  const [ap, recent] = await Promise.all([
    getActiveProgram(supabase, me),
    supabase.from("workout_sessions").select("id, log_date, duration_min, volume_kg, feeling, program_session_id, ended_at").eq("user_id", me.userId).not("ended_at", "is", null).order("started_at", { ascending: false }).limit(8),
  ]);
  const doneIds = (recent.data ?? []).map((w) => w.program_session_id).filter((x): x is string => Boolean(x));

  const sessions: ViewSession[] = (ap?.sessions ?? []).map((s) => ({
    id: s.id,
    week: s.week,
    weekday: s.weekday,
    name: s.name,
    isDeload: s.is_deload,
    exercises: s.program_exercises.map((e) => {
      const info = LIBRARY_BY_ID[e.exercise_id];
      const alts = new Set(info?.alternatives ?? []);
      return {
        id: e.id,
        exerciseId: e.exercise_id,
        name: info?.name ?? e.exercise_id,
        sets: e.sets,
        repsMin: e.reps_min,
        repsMax: e.reps_max,
        restS: e.rest_s,
        rir: e.rir,
        notes: e.notes,
        alternatives: [...alts].filter((a) => LIBRARY_BY_ID[a]).map((a) => ({ id: a, name: LIBRARY_BY_ID[a].name })),
      };
    }),
  }));

  return (
    <main className="space-y-4 px-4 pt-[max(18px,env(safe-area-inset-top))]">
      <header className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-sm text-muted">{ap ? `Semana ${ap.currentWeek} de ${ap.program.weeks}` : "Tu mesociclo"}</p>
          <h1 className="score text-[30px] leading-none">{ap ? ap.program.name : "Entreno"}</h1>
        </div>
        {ap ? <GenerateButton hasProgram /> : null}
      </header>

      {!me.gym?.weekdays?.length ? (
        <Empty title="Todavía no elegiste días de gym" action={<Link href="/perfil/ajustes/gimnasio" className="font-semibold text-accent">Elegir días</Link>}>
          Con eso armamos tu rutina.
        </Empty>
      ) : !ap ? (
        <div className="space-y-3">
          <ProfeBubble>
            Te armo un mesociclo de 4 semanas (3 de carga y 1 de descarga) según tu deporte, tu agenda y tu foco. Lo pesado va lejos de los partidos.
          </ProfeBubble>
          <GenerateButton hasProgram={false} />
        </div>
      ) : (
        <>
          {ap.finished ? (
            <ProfeBubble>¡Terminaste el mesociclo! 🎯 Armemos el siguiente teniendo en cuenta cómo te fue.</ProfeBubble>
          ) : ap.program.notes ? (
            <ProfeBubble>{ap.program.notes}</ProfeBubble>
          ) : null}
          <ProgramView
            programId={ap.program.id}
            weeks={ap.program.weeks}
            currentWeek={ap.currentWeek}
            todayWeekday={isoWeekday(me.today)}
            sessions={sessions}
            doneSessionIds={doneIds}
          />
        </>
      )}

      {recent.data?.length ? (
        <section className="rounded-[20px] border border-line bg-surface p-4">
          <h2 className="mb-2 font-semibold">Últimas sesiones</h2>
          <ul className="divide-y divide-line">
            {recent.data.map((w) => (
              <li key={w.id} className="tnum flex justify-between py-2 text-sm">
                <span>{formatDayShort(w.log_date)}</span>
                <span className="text-muted">
                  {w.duration_min ?? "—"} min · {fmt(Number(w.volume_kg ?? 0))} kg{w.feeling ? ` · ${w.feeling}/10` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
