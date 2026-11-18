"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronLeft, Info, Pause, Plus, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ProfeBubble } from "@/components/ui/profe";
import { cn, fmt, fmt1, vibrate } from "@/lib/utils";
import { PAIN_ZONES } from "@/lib/training/pain";
import { discardWorkoutAction, finishWorkoutAction, logSetAction, reportPainAction, startWorkoutAction } from "@/app/actions/training";
import { Celebrate } from "./celebrate";

export interface GymExercise {
  exerciseId: string;
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restS: number;
  rir: number | null;
  notes: string;
  instructions: string;
  mistakes: string;
  loadType: string;
  suggestedKg: number | null;
  suggestionReason: string;
  previous: { kg: number; reps: number; rir: number | null }[];
}

interface SetState {
  kg: number;
  reps: number;
  rir: number | null;
  done: boolean;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

export function GymMode({ programSessionId, title, exercises }: { programSessionId: string; title: string; exercises: GymExercise[] }) {
  const router = useRouter();
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [sets, setSets] = useState<Record<string, SetState[]>>(() =>
    Object.fromEntries(
      exercises.map((e) => [
        e.exerciseId,
        Array.from({ length: e.sets }, (_, i) => ({
          kg: e.suggestedKg ?? e.previous[i]?.kg ?? 0,
          reps: e.repsMax,
          rir: null,
          done: false,
        })),
      ]),
    ),
  );
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);
  const [open, setOpen] = useState<string | null>(exercises[0]?.exerciseId ?? null);
  const [pain, setPain] = useState<GymExercise | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [summary, setSummary] = useState<null | { durationMin: number; volumeKg: number; prs: { exercise: string; e1rm: number }[]; feedback: string }>(null);
  const [pending, start] = useTransition();
  const restBuzzed = useRef(false);

  useEffect(() => {
    startWorkoutAction(programSessionId).then((r) => {
      if (r.ok) setWorkoutId(r.workoutId);
      else toast.error(r.error);
    });
  }, [programSessionId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // fin del descanso: vibración
  const restLeft = rest ? Math.ceil((rest.until - now) / 1000) : 0;
  useEffect(() => {
    if (rest && restLeft <= 0 && !restBuzzed.current) {
      restBuzzed.current = true;
      vibrate([220, 120, 220]);
      toast("¡A la próxima serie! 💪", { duration: 2500 });
      setTimeout(() => setRest(null), 1500);
    }
  }, [rest, restLeft]);

  const update = (exId: string, i: number, patch: Partial<SetState>) =>
    setSets((s) => ({ ...s, [exId]: s[exId].map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

  const complete = useCallback(
    (ex: GymExercise, i: number) => {
      const st = sets[ex.exerciseId][i];
      if (!workoutId) return void toast.error("Esperá un segundo, estamos arrancando la sesión");
      vibrate(14);
      update(ex.exerciseId, i, { done: !st.done });
      if (st.done) return;
      logSetAction({ workoutId, exerciseId: ex.exerciseId, setNumber: i + 1, kg: st.kg, reps: st.reps, rir: st.rir }).then((r) => {
        if (!r.ok) {
          toast.error(r.error);
          update(ex.exerciseId, i, { done: false });
        }
      });
      // propagar kg a las siguientes series no hechas
      setSets((s) => ({ ...s, [ex.exerciseId]: s[ex.exerciseId].map((x, j) => (j > i && !x.done ? { ...x, kg: st.kg } : x)) }));
      if (ex.restS > 0) {
        restBuzzed.current = false;
        setRest({ until: Date.now() + ex.restS * 1000, total: ex.restS });
      }
      const allDone = sets[ex.exerciseId].every((x, j) => (j === i ? true : x.done));
      if (allDone) {
        const idx = exercises.findIndex((e) => e.exerciseId === ex.exerciseId);
        const next = exercises.slice(idx + 1).find((e) => !sets[e.exerciseId].every((x) => x.done));
        if (next) setTimeout(() => setOpen(next.exerciseId), 400);
      }
    },
    [sets, workoutId, exercises],
  );

  const totalSets = Object.values(sets).flat().length;
  const doneSets = Object.values(sets).flat().filter((s) => s.done).length;

  if (summary) {
    return (
      <main className="mx-auto max-w-lg space-y-4 px-5 pt-[max(24px,env(safe-area-inset-top))] pb-10">
        <Celebrate show={summary.prs.length > 0} />
        <h1 className="score text-[52px] leading-none">Sesión adentro</h1>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Duración" value={`${summary.durationMin} min`} />
          <Stat label="Volumen" value={`${fmt(summary.volumeKg)} kg`} />
        </div>
        {summary.prs.length ? (
          <section className="rounded-[20px] border border-accent/50 bg-accent/8 p-4">
            <p className="font-semibold text-accent">Récords personales 📈</p>
            <ul className="mt-2 space-y-1">
              {summary.prs.map((p) => (
                <li key={p.exercise} className="tnum flex justify-between">
                  <span>{p.exercise}</span>
                  <span className="font-semibold">{fmt1(p.e1rm)} kg 1RM est.</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <ProfeBubble>{summary.feedback}</ProfeBubble>
        <Button block size="lg" onClick={() => router.push("/entreno")}>
          Listo
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg pb-40">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-bg/95 px-3 pt-[max(10px,env(safe-area-inset-top))] pb-2 backdrop-blur">
        <Link href="/entreno" aria-label="Volver" className="grid size-10 place-items-center rounded-full text-muted">
          <ChevronLeft className="size-6" />
        </Link>
        <div className="flex-1">
          <p className="text-xs text-muted">
            {doneSets}/{totalSets} series · {mmss(Math.floor((now - startedAt) / 1000))}
          </p>
          <h1 className="score text-2xl leading-none">{title}</h1>
        </div>
        <Button size="sm" onClick={() => setFinishing(true)} disabled={!workoutId}>
          Terminar
        </Button>
      </header>

      <div className="space-y-2.5 px-2 pt-3">
        {exercises.map((ex) => {
          const st = sets[ex.exerciseId];
          const done = st.every((s) => s.done);
          const expanded = open === ex.exerciseId;
          const bw = ex.loadType === "bodyweight" || ex.loadType === "band";
          return (
            <section key={ex.exerciseId} className={cn("rounded-[20px] border bg-surface", expanded ? "border-accent/50" : "border-line", done && "opacity-70")}>
              <button type="button" onClick={() => setOpen(expanded ? null : ex.exerciseId)} className="flex w-full items-center gap-3 p-3.5 text-left" aria-expanded={expanded}>
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border text-sm font-bold", done ? "border-accent bg-accent text-accent-ink" : "border-line")}>
                  {done ? <Check className="size-4" /> : st.filter((s) => s.done).length}
                </span>
                <span className="flex-1">
                  <span className="block font-semibold leading-snug">{ex.name}</span>
                  <span className="tnum block text-sm text-muted">
                    {ex.sets} × {ex.repsMin === ex.repsMax ? ex.repsMin : `${ex.repsMin}–${ex.repsMax}`}
                    {ex.rir != null ? ` · RIR ${ex.rir}` : ""}
                    {ex.suggestedKg ? ` · ${fmt1(ex.suggestedKg)} kg` : ""}
                  </span>
                </span>
                <ChevronDown className={cn("size-5 text-muted transition-transform", expanded && "rotate-180")} />
              </button>
              <AnimatePresence initial={false}>
                {expanded ? (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="space-y-3 px-3 pb-4">
                      {ex.previous.length ? (
                        <p className="tnum text-sm text-muted">
                          La vez anterior: {ex.previous.map((p) => (bw ? `${p.reps}` : `${fmt1(p.kg)}×${p.reps}`)).join(" · ")}
                        </p>
                      ) : null}
                      {ex.suggestionReason ? <p className="text-sm text-accent">{ex.suggestionReason}</p> : null}
                      {ex.notes ? <p className="text-sm text-muted">{ex.notes}</p> : null}
                      <div className="space-y-2">
                        {st.map((s, i) => (
                          <div key={i} className={cn("flex items-center gap-1 rounded-[14px] border p-1.5", s.done ? "border-accent/40 bg-accent/6" : "border-line bg-surface-2")}>
                            <span className="w-4 text-center text-sm font-semibold text-muted">{i + 1}</span>
                            {!bw ? (
                              <NumField label="kg" value={s.kg} step={ex.loadType === "dumbbell" ? 2 : 2.5} onChange={(v) => update(ex.exerciseId, i, { kg: v })} disabled={s.done} />
                            ) : null}
                            <NumField label="reps" value={s.reps} step={1} onChange={(v) => update(ex.exerciseId, i, { reps: v })} disabled={s.done} />
                            <select
                              aria-label="RIR (repeticiones en reserva)"
                              value={s.rir ?? ""}
                              disabled={s.done}
                              onChange={(e) => update(ex.exerciseId, i, { rir: e.target.value === "" ? null : Number(e.target.value) })}
                              className="h-11 w-11 shrink-0 appearance-none rounded-[10px] border border-line bg-surface text-center text-sm"
                            >
                              <option value="">RIR</option>
                              {[0, 1, 2, 3, 4, 5].map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              aria-label={s.done ? `Desmarcar serie ${i + 1}` : `Marcar serie ${i + 1} hecha`}
                              onClick={() => complete(ex, i)}
                              className={cn("ml-auto grid size-11 shrink-0 place-items-center rounded-[12px] transition-colors", s.done ? "bg-accent text-accent-ink" : "border border-line text-muted")}
                            >
                              <Check className="size-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSets((x) => ({ ...x, [ex.exerciseId]: [...x[ex.exerciseId], { ...x[ex.exerciseId][x[ex.exerciseId].length - 1], done: false }] }))}
                          className="flex h-10 items-center gap-1 rounded-[10px] border border-line px-3 text-sm text-muted"
                        >
                          <Plus className="size-4" /> Serie
                        </button>
                        <details className="order-last w-full rounded-[10px] border border-line px-3 py-2 text-sm">
                          <summary className="flex cursor-pointer list-none items-center gap-1 text-muted">
                            <Info className="size-4" /> Cómo se hace
                          </summary>
                          <p className="mt-2">{ex.instructions}</p>
                          <p className="mt-1 text-muted">Ojo: {ex.mistakes}</p>
                        </details>
                        <button type="button" onClick={() => setPain(ex)} className="flex h-10 items-center gap-1 rounded-[10px] border border-alert/40 px-3 text-sm text-alert">
                          <TriangleAlert className="size-4" /> Molestia
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </section>
          );
        })}
      </div>

      {/* Timer de descanso */}
      <AnimatePresence>
        {rest ? (
          <motion.div
            initial={{ y: 120 }}
            animate={{ y: 0 }}
            exit={{ y: 120 }}
            className="fixed inset-x-0 bottom-[calc(76px+var(--safe-bottom))] z-40 mx-auto max-w-lg px-3"
          >
            <div className="flex items-center gap-3 rounded-[20px] border border-line bg-surface-2 p-3 shadow-2xl">
              <Pause className="size-5 text-water" />
              <div className="flex-1">
                <p className="text-xs text-muted">Descanso</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full bg-water transition-[width] duration-500" style={{ width: `${Math.max(0, (restLeft / rest.total) * 100)}%` }} />
                </div>
              </div>
              <span className="score w-16 text-right text-3xl" aria-live="polite">
                {mmss(Math.max(0, restLeft))}
              </span>
              <button type="button" aria-label="Saltear descanso" onClick={() => setRest(null)} className="grid size-10 place-items-center rounded-full text-muted">
                <X className="size-5" />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <PainSheet ex={pain} workoutId={workoutId} onClose={() => setPain(null)} />
      <FinishSheet
        open={finishing}
        onOpenChange={setFinishing}
        pending={pending}
        doneSets={doneSets}
        onDiscard={() =>
          start(async () => {
            if (workoutId) await discardWorkoutAction(workoutId);
            router.push("/entreno");
          })
        }
        onFinish={(feeling) =>
          start(async () => {
            if (!workoutId) return;
            const r = await finishWorkoutAction({ workoutId, feeling });
            if (!r.ok) return void toast.error(r.error);
            vibrate([20, 60, 20, 60, 40]);
            setFinishing(false);
            setSummary(r.summary);
            router.refresh();
          })
        }
      />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="score text-4xl">{value}</p>
    </div>
  );
}

function NumField({ label, value, step, onChange, disabled }: { label: string; value: number; step: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="flex shrink-0 items-center rounded-[10px] border border-line bg-surface">
      <button type="button" disabled={disabled} aria-label={`Restar ${label}`} onClick={() => onChange(Math.max(0, Math.round((value - step) * 100) / 100))} className="h-11 w-7 text-lg text-muted disabled:opacity-30">
        −
      </button>
      <label className="flex flex-col items-center">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="score w-10 bg-transparent text-center text-xl outline-none"
        />
        <span className="-mt-0.5 text-[10px] text-muted">{label}</span>
      </label>
      <button type="button" disabled={disabled} aria-label={`Sumar ${label}`} onClick={() => onChange(Math.round((value + step) * 100) / 100)} className="h-11 w-7 text-lg text-muted disabled:opacity-30">
        +
      </button>
    </div>
  );
}

function PainSheet({ ex, workoutId, onClose }: { ex: GymExercise | null; workoutId: string | null; onClose: () => void }) {
  const [zone, setZone] = useState("knee");
  const [intensity, setIntensity] = useState(4);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Sheet open={ex !== null} onOpenChange={(o) => !o && onClose()} title="¿Dónde te molesta?" description="No diagnosticamos: ajustamos la rutina y te decimos cuándo consultar.">
      <div className="space-y-4 pb-2">
        <div className="grid grid-cols-2 gap-2">
          {PAIN_ZONES.map((z) => (
            <button
              key={z.value}
              type="button"
              aria-pressed={zone === z.value}
              onClick={() => setZone(z.value)}
              className={cn("h-11 rounded-[12px] border text-sm font-medium", zone === z.value ? "border-alert bg-alert/12 text-alert" : "border-line bg-surface-2")}
            >
              {z.label}
            </button>
          ))}
        </div>
        <div>
          <p className="mb-2 flex justify-between text-sm">
            <span className="text-muted">Intensidad</span>
            <span className="score text-2xl">{intensity}/10</span>
          </p>
          <input type="range" min={1} max={10} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} className="w-full accent-[var(--alert)]" aria-label="Intensidad del dolor" />
        </div>
        <Button
          block
          variant="danger"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await reportPainAction({ workoutId, exerciseId: ex?.exerciseId ?? null, zone, intensity });
              if (!r.ok) return void toast.error(r.error);
              toast(r.message, { duration: 8000 });
              onClose();
              router.refresh();
            })
          }
        >
          Reportar molestia
        </Button>
      </div>
    </Sheet>
  );
}

function FinishSheet({
  open,
  onOpenChange,
  onFinish,
  onDiscard,
  pending,
  doneSets,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onFinish: (feeling: number | null) => void;
  onDiscard: () => void;
  pending: boolean;
  doneSets: number;
}) {
  const [feeling, setFeeling] = useState<string>("7");
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="¿Cómo te sentiste?" description="Del 1 (me arrastré) al 10 (volé).">
      <div className="space-y-4 pb-2">
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={feeling === n}
              onClick={() => setFeeling(n)}
              className={cn("score h-12 rounded-[12px] border text-2xl", feeling === n ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface-2")}
            >
              {n}
            </button>
          ))}
        </div>
        <Button block size="lg" disabled={pending || doneSets === 0} onClick={() => onFinish(Number(feeling))}>
          {pending ? "Guardando…" : doneSets === 0 ? "Marcá al menos una serie" : "Terminar sesión"}
        </Button>
        <Button block variant="ghost" size="sm" disabled={pending} onClick={onDiscard}>
          Descartar sesión
        </Button>
      </div>
    </Sheet>
  );
}
