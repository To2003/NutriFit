"use client";
import { motion } from "motion/react";
import { CountUp, MacroBar } from "@/components/ui/meters";
import { DAY_TYPE_INFO } from "@/lib/domain/catalog";
import type { DayType } from "@/lib/calc/types";
import { cn, fmt } from "@/lib/utils";

/** El marcador del día: lo comido contra el objetivo, como un tablero de cancha. */
export function Scoreboard({
  dayType,
  dayLabel,
  kcal,
  target,
  protein,
  carbs,
  fat,
}: {
  dayType: DayType;
  dayLabel?: string;
  kcal: number;
  target: number;
  protein: [number, number];
  carbs: [number, number];
  fat: [number, number];
}) {
  const left = target - kcal;
  const pct = target > 0 ? Math.min(kcal / target, 1.2) : 0;
  const info = DAY_TYPE_INFO[dayType];
  return (
    <section aria-label="Resumen de hoy" className="overflow-hidden rounded-[26px] bg-surface shadow-[0_18px_40px_-18px_rgba(109,59,255,0.65)]">
      <div className="bg-grad relative px-5 pt-4 pb-5 text-white">
        <span aria-hidden className="pointer-events-none absolute -top-10 -right-8 size-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <p className="rounded-full bg-white/18 px-3 py-1 text-sm font-semibold backdrop-blur">
            {info.emoji} {dayLabel ?? info.label}
          </p>
          <p className="tnum text-sm text-white/80">objetivo {fmt(target)}</p>
        </div>
        <div className="relative mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-white/80">Comiste</p>
            <CountUp value={kcal} className="score block text-[46px]" />
          </div>
          <div className="text-right">
            <p className="text-sm text-white/80">{left >= 0 ? "Te quedan" : "Te pasaste"}</p>
            <CountUp value={Math.abs(left)} className={cn("score block text-[46px]", left >= 0 ? "text-accent" : "text-white")} />
          </div>
        </div>
        <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-black/25" aria-hidden>
          <motion.div
            className={cn("h-full rounded-full", pct > 1.05 ? "bg-white" : "bg-accent")}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(pct, 1) * 100}%` }}
            transition={{ type: "spring", damping: 26, stiffness: 120 }}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 px-5 pt-3.5 pb-4">
        <MacroBar label="Proteína" value={protein[0]} target={protein[1]} color="var(--protein)" />
        <MacroBar label="Carbos" value={carbs[0]} target={carbs[1]} color="var(--carbs)" />
        <MacroBar label="Grasa" value={fat[0]} target={fat[1]} color="var(--fat)" />
      </div>
    </section>
  );
}
