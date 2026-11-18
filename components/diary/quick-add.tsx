"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { Activity, Droplets, Scale, UtensilsCrossed } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { vibrate } from "@/lib/utils";
import { FoodComposer } from "./food-composer";
import { WaterSheet } from "./water-sheet";
import { WeightSheet } from "./weight-sheet";
import { ActivitySheet } from "./activity-sheet";

type Mode = "food" | "water" | "weight" | "activity" | null;

const OPTIONS = [
  { mode: "food", label: "Comida", hint: "Texto, foto o buscador", Icon: UtensilsCrossed, tone: "text-accent" },
  { mode: "water", label: "Agua", hint: "Vaso, botella o a mano", Icon: Droplets, tone: "text-water" },
  { mode: "weight", label: "Peso", hint: "Mejor a la mañana", Icon: Scale, tone: "text-text" },
  { mode: "activity", label: "Actividad", hint: "Deporte o cardio", Icon: Activity, tone: "text-alert" },
] as const;

export function QuickAdd({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  // Atajos del manifest: /diario?add=food|water abre directo esa carga
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return null;
    const add = new URLSearchParams(window.location.search).get("add");
    return add === "food" || add === "water" || add === "weight" || add === "activity" ? add : null;
  });

  const go = (m: Exclude<Mode, null>) => {
    vibrate(8);
    onOpenChange(false);
    setTimeout(() => setMode(m), 120);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange} title="¿Qué cargamos?">
        <div className="grid grid-cols-2 gap-2.5 pb-2">
          {OPTIONS.map((o, i) => (
            <motion.button
              key={o.mode}
              type="button"
              onClick={() => go(o.mode)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * i }}
              className="flex aspect-[1.25] flex-col justify-between rounded-[18px] border border-line bg-surface-2 p-4 text-left active:scale-[0.97]"
            >
              <o.Icon className={`size-7 ${o.tone}`} />
              <span>
                <span className="block text-lg font-bold">{o.label}</span>
                <span className="block text-xs text-muted">{o.hint}</span>
              </span>
            </motion.button>
          ))}
        </div>
      </Sheet>
      <FoodComposer open={mode === "food"} onOpenChange={(o) => !o && setMode(null)} />
      <WaterSheet open={mode === "water"} onOpenChange={(o) => !o && setMode(null)} />
      <WeightSheet open={mode === "weight"} onOpenChange={(o) => !o && setMode(null)} />
      <ActivitySheet open={mode === "activity"} onOpenChange={(o) => !o && setMode(null)} />
    </>
  );
}
