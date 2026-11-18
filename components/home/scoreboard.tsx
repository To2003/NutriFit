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
    <section aria-label="Resumen de hoy" className="overflow-hidden rounded-[22px] border border-line bg-surface">
      <div className="flex items-center justify-between px-4 pt-3.5">
        <p className={cn("font-semibold", dayType === "match" && "text-accent")}>
          {dayLabel ?? info.label} {info.emoji}
        </p>
        <p className="tnum text-sm text-muted">objetivo {fmt(target)}</p>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end px-4 pt-2 pb-4">
        <div>
          <p className="text-xs text-muted">Comiste</p>
          <CountUp value={kcal} className="score block text-[68px] text-text" />
        </div>
        <div className="mx-3 mb-3 h-14 w-px bg-line" aria-hidden />
        <div className="text-right">
          <p className="text-xs text-muted">{left >= 0 ? "Te quedan" : "Te pasaste"}</p>
          <CountUp value={Math.abs(left)} className={cn("score block text-[68px]", left >= 0 ? "text-accent" : "text-alert")} />
        </div>
      </div>
      {/* "Red" de la cancha con el progreso */}
      <div className="relative mx-4 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <motion.div
          className={cn("h-full rounded-full", pct > 1.05 ? "bg-alert" : "bg-accent")}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 1) * 100}%` }}
          transition={{ type: "spring", damping: 26, stiffness: 120 }}
        />
        <span className="absolute inset-y-0 left-1/2 w-px bg-bg" />
      </div>
      <div className="grid grid-cols-3 gap-3 px-4 pt-3 pb-4">
        <MacroBar label="Proteína" value={protein[0]} target={protein[1]} color="var(--protein)" />
        <MacroBar label="Carbos" value={carbs[0]} target={carbs[1]} color="var(--carbs)" />
        <MacroBar label="Grasa" value={fat[0]} target={fat[1]} color="var(--fat)" />
      </div>
    </section>
  );
}
