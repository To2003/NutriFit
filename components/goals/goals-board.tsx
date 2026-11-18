"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Stepper, Toggle } from "@/components/ui/choice";
import { Card } from "@/components/ui/card";
import { ProfeBubble } from "@/components/ui/profe";
import { DAY_TYPE_INFO, WEEKDAY_LABELS } from "@/lib/domain/catalog";
import { cn, fmt, vibrate } from "@/lib/utils";
import type { StoredTargets, StoredTypeTargets } from "@/lib/data/targets";
import type { ActionResult } from "@/app/(onboarding)/onboarding/actions";

const ORDER = ["match", "training", "rest"] as const;

function recomputeCarbs(t: StoredTypeTargets, kcal: number): StoredTypeTargets {
  const carbs = Math.max(0, Math.round((kcal - t.protein_g * 4 - t.fat_g * 9) / 4));
  return { ...t, kcal, carbs_g: carbs };
}

export function GoalsBoard({
  auto,
  current,
  manualInitially,
  explanation,
  onSave,
  saveLabel,
  redirectTo,
}: {
  auto: StoredTargets;
  current: StoredTargets | null;
  manualInitially: boolean;
  explanation: string[];
  onSave: (manual: StoredTargets | null) => Promise<ActionResult>;
  saveLabel: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [manual, setManual] = useState(manualInitially);
  const [values, setValues] = useState<StoredTargets>(manualInitially && current ? current : auto);
  const [pending, start] = useTransition();
  const shown = manual ? values : auto;
  const types = useMemo(() => ORDER.filter((t) => auto[t]), [auto]);

  return (
    <div className="space-y-4">
      {types.map((type, i) => {
        const t = shown[type] ?? auto[type]!;
        const info = DAY_TYPE_INFO[type];
        return (
          <motion.div
            key={type}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, type: "spring", damping: 26, stiffness: 220 }}
          >
            <Card className={cn("overflow-hidden p-0", type === "match" && "bg-grad border-0 text-white shadow-[0_18px_40px_-18px_rgba(109,59,255,0.65)]")}>
              <div className="flex items-center justify-between px-4 pt-3.5">
                <p className="font-semibold">
                  {info.emoji} {info.label}
                </p>
                <p className={cn("text-sm", type === "match" ? "text-white/80" : "text-muted")}>{(auto[type]?.weekdays ?? []).map((d) => WEEKDAY_LABELS[d].short).join(", ")}</p>
              </div>
              <div className="flex items-end gap-2 px-4 pt-2 pb-3">
                <span className={cn("score text-[44px]", type === "match" ? "text-white" : "text-text")}>{fmt(t.kcal)}</span>
                <span className={cn("pb-2", type === "match" ? "text-white/75" : "text-muted")}>kcal</span>
              </div>
              {manual ? (
                <div className="px-4 pb-3">
                  <Stepper
                    label={`kcal ${info.short}`}
                    value={t.kcal}
                    step={50}
                    min={1200}
                    max={6000}
                    onChange={(k) => setValues((v) => ({ ...v, [type]: recomputeCarbs(v[type] ?? auto[type]!, k) }))}
                  />
                </div>
              ) : null}
              <dl className={cn("grid grid-cols-4 divide-x text-center", type === "match" ? "divide-white/15 bg-black/20" : "divide-line border-t border-line")}>
                {[
                  { k: "Proteína", v: t.protein_g, u: "g", c: "text-protein" },
                  { k: "Carbos", v: t.carbs_g, u: "g", c: "text-carbs" },
                  { k: "Grasa", v: t.fat_g, u: "g", c: "text-fat" },
                  { k: "Agua", v: t.water_ml / 1000, u: "L", c: "text-water" },
                ].map((m) => (
                  <div key={m.k} className="px-1 py-3">
                    <dt className={cn("text-xs", type === "match" ? "text-white/75" : "text-muted")}>{m.k}</dt>
                    <dd className={cn("score mt-1 text-xl", type === "match" ? "text-white" : m.c)}>
                      {m.u === "L" ? m.v.toLocaleString("es-AR", { maximumFractionDigits: 1 }) : fmt(m.v)}
                      <span className={cn("ml-0.5 text-sm", type === "match" ? "text-white/70" : "text-muted")}>{m.u}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          </motion.div>
        );
      })}

      <ProfeBubble>
        <ul className="space-y-1.5">
          {explanation.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </ProfeBubble>

      <Card className="py-1">
        <Toggle
          checked={manual}
          onChange={(m) => {
            setManual(m);
            if (m && !current) setValues(auto);
          }}
          label="Ajustar a mano"
          description="Si tu nutricionista te pasó otros números. La proteína y la grasa quedan; los carbos se acomodan."
        />
      </Card>

      <Button
        size="lg"
        block
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await onSave(manual ? values : null);
            if (!r.ok) {
              toast.error(r.error);
              return;
            }
            vibrate([10, 40, 20]);
            toast.success("Objetivos guardados");
            if (redirectTo) router.push(redirectTo);
            else router.refresh();
          })
        }
      >
        {pending ? "Guardando…" : saveLabel}
      </Button>
      <p className="pb-4 text-center text-xs text-muted">NutriFit no reemplaza a un médico, nutricionista ni deportólogo.</p>
    </div>
  );
}
