"use client";
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfeBubble } from "@/components/ui/profe";
import { generateDailyCloseAction, generateWeeklyReviewAction, respondTdeeAction, toggleWeeklyGoalAction } from "@/app/actions/agent";
import { cn, fmt, vibrate } from "@/lib/utils";

export function DailyCloseCard({ close, canGenerate }: { close: { resumen: string; bien: string; ajuste: string } | null; canGenerate: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  if (close)
    return (
      <section aria-label="Cierre del día" className="rounded-[22px] border border-line bg-surface p-4">
        <h2 className="mb-2 font-semibold">Cierre del día 🌙</h2>
        <ProfeBubble>
          <p>{close.resumen}</p>
          <p className="mt-1.5">
            <span className="font-semibold text-accent">Bien: </span>
            {close.bien}
          </p>
          <p className="mt-1.5">
            <span className="font-semibold text-water">Para mañana: </span>
            {close.ajuste}
          </p>
        </ProfeBubble>
      </section>
    );
  if (!canGenerate) return null;
  return (
    <Button
      variant="secondary"
      block
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await generateDailyCloseAction();
          if (!r.ok) toast.error(r.error);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : "🌙"} {pending ? "El Profe está haciendo cuentas…" : "Cerrar el día"}
    </Button>
  );
}

export function WeeklyCard({
  review,
  goals,
  proposal,
  canGenerate,
}: {
  review: { text: string } | null;
  goals: { id: string; text: string; done: boolean }[];
  proposal: { id: string; previous: number; observed: number; proposed: number } | null;
  canGenerate: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [optGoals, toggle] = useOptimistic(goals, (cur, id: string) => cur.map((g) => (g.id === id ? { ...g, done: !g.done } : g)));
  if (!review && !goals.length && !proposal && !canGenerate) return null;
  return (
    <section aria-label="Revisión semanal" className="space-y-3 rounded-[22px] border border-line bg-surface p-4">
      <h2 className="font-semibold">Semana 📊</h2>
      {review ? <ProfeBubble>{review.text}</ProfeBubble> : null}
      {proposal ? (
        <div className="rounded-[16px] border border-accent/40 bg-accent/6 p-3.5">
          <p className="font-semibold">Ajuste de objetivos</p>
          <p className="mt-1 text-sm text-muted">
            Con tus registros, tu gasto real ronda las <span className="font-semibold text-text">{fmt(proposal.observed)} kcal</span>. Propongo pasar tu base de {fmt(proposal.previous)} a{" "}
            <span className="font-semibold text-text">{fmt(proposal.proposed)} kcal</span> (máximo ±200 por semana).
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await respondTdeeAction(proposal.id, true);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Objetivos actualizados");
                  router.refresh();
                })
              }
            >
              Aceptar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await respondTdeeAction(proposal.id, false);
                  router.refresh();
                })
              }
            >
              Dejar como está
            </Button>
          </div>
        </div>
      ) : null}
      {optGoals.length ? (
        <div>
          <p className="mb-1.5 text-sm text-muted">Objetivos de la semana</p>
          <ul className="space-y-1.5">
            {optGoals.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  aria-pressed={g.done}
                  onClick={() =>
                    start(async () => {
                      vibrate(10);
                      toggle(g.id);
                      await toggleWeeklyGoalAction(g.id, !g.done);
                      router.refresh();
                    })
                  }
                  className="flex min-h-11 w-full items-center gap-3 rounded-[12px] bg-surface-2 px-3 py-2 text-left"
                >
                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-[7px] border", g.done ? "border-accent bg-accent text-accent-ink" : "border-line")}>
                    {g.done ? <Check className="size-4" /> : null}
                  </span>
                  <span className={cn(g.done && "text-muted line-through")}>{g.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {!review && canGenerate ? (
        <Button
          variant="secondary"
          block
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await generateWeeklyReviewAction();
              if (!r.ok) toast.error(r.error);
              router.refresh();
            })
          }
        >
          {pending ? "Armando la revisión…" : "Ver revisión semanal"}
        </Button>
      ) : null}
    </section>
  );
}
