"use client";
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Droplets, Undo2 } from "lucide-react";
import { Ring } from "@/components/ui/meters";
import { Button } from "@/components/ui/button";
import { addWaterAction, undoLastWaterAction } from "@/app/actions/diary";
import { fmt1, vibrate } from "@/lib/utils";
import { profeToast } from "@/components/diary/profe-toast";

export function WaterCard({ ml, target, date }: { ml: number; target: number; date: string }) {
  const router = useRouter();
  const [optimistic, add] = useOptimistic(ml, (cur: number, delta: number) => cur + delta);
  const [pending, start] = useTransition();
  const plus = () =>
    start(async () => {
      vibrate(10);
      add(250);
      const r = await addWaterAction({ ml: 250, date });
      if (!r.ok) toast.error(r.error);
      else if (r.feedback && optimistic + 250 >= target && ml < target) profeToast(r.feedback);
      router.refresh();
    });
  return (
    <section aria-label="Agua" className="flex items-center gap-4 rounded-[22px] border border-line bg-surface p-4">
      <Ring value={optimistic} max={target} size={84} stroke={8} color="var(--water)" label={`Agua: ${optimistic} de ${target} ml`}>
        <Droplets className="size-6 text-water" />
      </Ring>
      <div className="flex-1">
        <p className="text-sm text-muted">Agua</p>
        <p className="score text-[30px]">
          {fmt1(optimistic / 1000)}
          <span className="font-sans text-base font-normal text-muted"> / {fmt1(target / 1000)} L</span>
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Button size="md" onClick={plus} disabled={pending} className="bg-water text-[#05222b]" aria-label="Sumar 250 ml de agua">
          +250
        </Button>
        {ml > 0 ? (
          <button
            type="button"
            className="flex items-center gap-1 px-1 text-xs text-muted"
            onClick={() =>
              start(async () => {
                await undoLastWaterAction({ date });
                router.refresh();
              })
            }
          >
            <Undo2 className="size-3.5" /> deshacer
          </button>
        ) : null}
      </div>
    </section>
  );
}
