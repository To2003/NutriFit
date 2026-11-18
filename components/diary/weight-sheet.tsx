"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/choice";
import { logWeightAction } from "@/app/actions/diary";
import { useActiveDate, useAppCtx } from "@/components/app/app-context";
import { profeToast } from "./profe-toast";

export function WeightSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { lastWeightKg } = useAppCtx();
  const date = useActiveDate();
  const router = useRouter();
  const [kg, setKg] = useState(lastWeightKg ?? 75);
  const [pending, start] = useTransition();
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Peso" description="Ideal: a la mañana, en ayunas y después del baño.">
      <div className="space-y-4 pb-2">
        <Stepper label="Peso en kg" value={kg} onChange={setKg} step={0.1} min={30} max={300} suffix="kg" />
        <Button
          block
          size="lg"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await logWeightAction({ kg, date });
              if (!r.ok) return void toast.error(r.error);
              onOpenChange(false);
              profeToast(r.feedback, "Peso anotado");
              router.refresh();
            })
          }
        >
          Guardar
        </Button>
      </div>
    </Sheet>
  );
}
