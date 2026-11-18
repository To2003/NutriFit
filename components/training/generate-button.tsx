"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { generateProgramAction } from "@/app/actions/training";
import { vibrate } from "@/lib/utils";

export function GenerateButton({ hasProgram }: { hasProgram: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const run = () =>
    start(async () => {
      setConfirm(false);
      const r = await generateProgramAction();
      if (!r.ok) return void toast.error(r.error);
      vibrate([10, 40, 20]);
      toast.success(r.source === "ai" ? "Rutina lista. La armó el Profe." : "Rutina lista. El Profe está sin señal, la armé con las reglas de siempre.");
      router.refresh();
    });
  return (
    <>
      <Button block={!hasProgram} size={hasProgram ? "sm" : "lg"} variant={hasProgram ? "outline" : "primary"} disabled={pending} onClick={() => (hasProgram ? setConfirm(true) : run())}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {pending ? "Armando tu mesociclo…" : hasProgram ? "Rehacer rutina" : "Armar mi rutina"}
      </Button>
      <Sheet open={confirm} onOpenChange={setConfirm} title="¿Rehacer la rutina?" description="Se archiva la actual (tus registros quedan) y arrancás un mesociclo nuevo desde esta semana.">
        <div className="flex gap-2 pb-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>
            Mejor no
          </Button>
          <Button className="flex-1" onClick={run}>
            Rehacer
          </Button>
        </div>
      </Sheet>
    </>
  );
}
