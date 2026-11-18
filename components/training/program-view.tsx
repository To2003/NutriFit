"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, Play } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WEEKDAY_LABELS } from "@/lib/domain/catalog";
import { swapExerciseAction } from "@/app/actions/training";

export interface ViewExercise {
  id: string;
  exerciseId: string;
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restS: number;
  rir: number | null;
  notes: string;
  alternatives: { id: string; name: string }[];
}
export interface ViewSession {
  id: string;
  week: number;
  weekday: number;
  name: string;
  isDeload: boolean;
  exercises: ViewExercise[];
}

export function ProgramView({
  programId,
  weeks,
  currentWeek,
  todayWeekday,
  sessions,
  doneSessionIds,
}: {
  programId: string;
  weeks: number;
  currentWeek: number;
  todayWeekday: number;
  sessions: ViewSession[];
  doneSessionIds: string[];
}) {
  const [week, setWeek] = useState(currentWeek);
  const [swap, setSwap] = useState<ViewExercise | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const list = sessions.filter((s) => s.week === week);
  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Semana" className="grid grid-cols-4 gap-1.5">
        {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => (
          <button
            key={w}
            role="tab"
            aria-selected={week === w}
            onClick={() => setWeek(w)}
            className={cn(
              "h-12 rounded-[12px] border text-sm font-semibold",
              week === w ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface-2",
              w === currentWeek && week !== w && "border-accent/60",
            )}
          >
            S{w}
            {w === weeks ? <span className="block text-[10px] font-medium opacity-70">descarga</span> : w === currentWeek ? <span className="block text-[10px] font-medium opacity-70">actual</span> : null}
          </button>
        ))}
      </div>
      {list.map((s) => {
        const done = doneSessionIds.includes(s.id);
        const isToday = week === currentWeek && s.weekday === todayWeekday;
        return (
          <section key={s.id} className={cn("rounded-[20px] border bg-surface p-4", isToday ? "border-accent/60" : "border-line")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted first-letter:uppercase">
                  {WEEKDAY_LABELS[s.weekday].long}
                  {isToday ? " · hoy" : ""}
                  {done ? " · hecha ✓" : ""}
                </p>
                <h3 className="score text-2xl">{s.name}</h3>
              </div>
              {week === currentWeek && !done ? (
                <Button asChild size="sm" variant={isToday ? "primary" : "secondary"}>
                  <Link href={`/entreno/sesion/${s.id}`}>
                    <Play className="size-4" /> Empezar
                  </Link>
                </Button>
              ) : null}
            </div>
            <ol className="mt-3 divide-y divide-line">
              {s.exercises.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1">
                    <p className="font-medium leading-snug">{e.name}</p>
                    <p className="tnum text-sm text-muted">
                      {e.sets} × {e.repsMin === e.repsMax ? e.repsMin : `${e.repsMin}–${e.repsMax}`}
                      {e.rir != null ? ` · RIR ${e.rir}` : ""} · {Math.floor(e.restS / 60)}:{String(e.restS % 60).padStart(2, "0")}
                    </p>
                  </div>
                  {e.alternatives.length ? (
                    <button type="button" onClick={() => setSwap(e)} aria-label={`Cambiar ${e.name}`} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2">
                      <ArrowLeftRight className="size-4.5" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
      <Sheet open={swap !== null} onOpenChange={(o) => !o && setSwap(null)} title={swap ? `Cambiar ${swap.name}` : ""} description="Se cambia en todas las semanas de este mesociclo.">
        <div className="space-y-2 pb-2">
          {swap?.alternatives.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await swapExerciseAction({ programId, fromId: swap.exerciseId, toId: a.id });
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(`Listo: ${a.name}`);
                  setSwap(null);
                  router.refresh();
                })
              }
              className="flex h-14 w-full items-center rounded-[14px] border border-line bg-surface-2 px-4 text-left font-medium active:scale-[0.99]"
            >
              {a.name}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
