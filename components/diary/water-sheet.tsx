"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/choice";
import { addWaterAction } from "@/app/actions/diary";
import { useActiveDate, useAppCtx } from "@/components/app/app-context";
import { vibrate } from "@/lib/utils";
import { profeToast } from "./profe-toast";

export function WaterSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { glassMl, bottleMl } = useAppCtx();
  const date = useActiveDate();
  const router = useRouter();
  const [custom, setCustom] = useState(300);
  const [pending, start] = useTransition();
  const add = (ml: number) =>
    start(async () => {
      vibrate(10);
      const r = await addWaterAction({ ml, date });
      if (!r.ok) return void toast.error(r.error);
      onOpenChange(false);
      profeToast(r.feedback, `+${ml} ml 💧`);
      router.refresh();
    });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Agua" description="Un toque y listo.">
      <div className="space-y-3 pb-2">
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { ml: 250, label: "+250 ml" },
            { ml: 500, label: "+500 ml" },
            { ml: glassMl, label: `Vaso (${glassMl} ml)` },
            { ml: bottleMl, label: `Botella (${bottleMl} ml)` },
          ].map((o, i) => (
            <button
              key={i}
              type="button"
              disabled={pending}
              onClick={() => add(o.ml)}
              className="h-20 rounded-[16px] border border-water/30 bg-water/8 text-lg font-bold text-water active:scale-[0.97] disabled:opacity-50"
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="rounded-[16px] border border-line p-3">
          <p className="mb-2 text-sm text-muted">Otra cantidad</p>
          <Stepper label="Mililitros" value={custom} onChange={setCustom} step={50} min={50} max={3000} suffix="ml" />
          <Button className="mt-3" block variant="secondary" disabled={pending} onClick={() => add(custom)}>
            Sumar {custom} ml
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
