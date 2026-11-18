"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { logMeasurementsAction, logTestAction } from "@/app/actions/body";
import { TEST_INFO, type TestKind } from "@/lib/domain/tests";

const MEASURES = [
  { k: "waist", label: "Cintura (al ombligo)" },
  { k: "hip", label: "Cadera" },
  { k: "chest", label: "Pecho" },
  { k: "arm", label: "Brazo" },
  { k: "thigh", label: "Muslo" },
  { k: "neck", label: "Cuello" },
] as const;

export function MeasurementsForm() {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const num = (s?: string) => (s && s.trim() ? Number(s.replace(",", ".")) : null);
  return (
    <>
      <Button block variant="secondary" onClick={() => setOpen(true)}>
        Cargar medidas
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title="Medidas con cinta" description="En cm, a la mañana, sin apretar la cinta. Cargá las que quieras.">
        <div className="space-y-3 pb-2">
          <div className="grid grid-cols-2 gap-3">
            {MEASURES.map((m) => (
              <Field key={m.k} label={m.label}>
                <Input inputMode="decimal" value={v[m.k] ?? ""} onChange={(e) => setV({ ...v, [m.k]: e.target.value })} placeholder="cm" />
              </Field>
            ))}
          </div>
          <Button
            block
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await logMeasurementsAction({ waist: num(v.waist), hip: num(v.hip), chest: num(v.chest), arm: num(v.arm), thigh: num(v.thigh), neck: num(v.neck) });
                if (!r.ok) return void toast.error(r.error);
                toast.success(r.message ?? "Guardado");
                setOpen(false);
                setV({});
                router.refresh();
              })
            }
          >
            Guardar
          </Button>
        </div>
      </Sheet>
    </>
  );
}

export function TestForm({ test }: { test: TestKind }) {
  const info = TEST_INFO[test];
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Cargar
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title={info.label}>
        <div className="space-y-3 pb-2">
          <p className="rounded-[12px] bg-surface-2 p-3 text-sm text-muted">{info.how}</p>
          <Field label={`Resultado (${info.unit})`}>
            <Input autoFocus inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <Button
            block
            disabled={pending || !value}
            onClick={() =>
              start(async () => {
                const r = await logTestAction({ test, value: Number(value.replace(",", ".")) });
                if (!r.ok) return void toast.error(r.error);
                toast.success(r.message ?? "Guardado");
                setOpen(false);
                setValue("");
                router.refresh();
              })
            }
          >
            Guardar
          </Button>
        </div>
      </Sheet>
    </>
  );
}
