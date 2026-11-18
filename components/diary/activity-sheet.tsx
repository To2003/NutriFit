"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Segmented, Stepper } from "@/components/ui/choice";
import { logActivityAction } from "@/app/actions/diary";
import { useActiveDate, useAppCtx, type PlannedToday } from "@/components/app/app-context";
import { INTENSITIES, SPORT_INFO } from "@/lib/domain/catalog";
import { SPORTS, type Sport } from "@/lib/calc/types";
import { isoWeekday } from "@/lib/dates";
import { profeToast } from "./profe-toast";

export function PlannedCard({ p, date, onDone }: { p: PlannedToday; date: string; onDone?: () => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [duration, setDuration] = useState(p.duration_min);
  const [intensity, setIntensity] = useState(p.intensity);
  const [pending, start] = useTransition();
  const info = SPORT_INFO[p.sport];
  const send = (status: "done" | "skipped") =>
    start(async () => {
      const r = await logActivityAction({
        date,
        sport: p.sport,
        kind: p.kind,
        intensity,
        duration_min: duration,
        status,
        schedule_id: p.scheduleId,
      });
      if (!r.ok) return void toast.error(r.error);
      profeToast(r.feedback, status === "done" ? "¡Anotado! 💪" : "Anotado. Otra vez será.");
      onDone?.();
      router.refresh();
    });
  return (
    <div className="rounded-[16px] border border-line bg-surface-2 p-3.5">
      <p className="font-semibold">
        {info.emoji} Hoy tenés {info.label.toLowerCase()} {p.kind === "match" ? "(partido)" : ""}
        {p.start_time ? ` a las ${p.start_time.slice(0, 5)}` : ""} — ¿lo hiciste?
      </p>
      {editing ? (
        <div className="mt-3 space-y-3">
          <Stepper label="Minutos" value={duration} onChange={setDuration} step={10} min={5} max={600} suffix="min" />
          <Segmented label="Intensidad" value={intensity} onChange={setIntensity} options={INTENSITIES.map((i) => ({ value: i.value, label: i.label }))} />
        </div>
      ) : (
        <p className="mt-0.5 text-sm text-muted">
          {duration} min · {INTENSITIES.find((i) => i.value === intensity)?.label.toLowerCase()}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Button size="md" className="flex-1" disabled={pending} onClick={() => send("done")}>
          <Check className="size-5" /> Sí
        </Button>
        {!editing ? (
          <Button size="md" variant="secondary" disabled={pending} onClick={() => setEditing(true)}>
            Editar
          </Button>
        ) : null}
        <Button size="md" variant="outline" disabled={pending} onClick={() => send("skipped")} aria-label="No fui">
          <X className="size-5" /> No fui
        </Button>
      </div>
    </div>
  );
}

export function ActivitySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { schedule, sports } = useAppCtx();
  const date = useActiveDate();
  const router = useRouter();
  const planned = schedule.filter((s) => s.weekday === isoWeekday(date));
  const [sport, setSport] = useState<Sport>(sports[0] ?? "running");
  const [kind, setKind] = useState<"training" | "match">("training");
  const [duration, setDuration] = useState(60);
  const [intensity, setIntensity] = useState<"light" | "moderate" | "hard">("moderate");
  const [pending, start] = useTransition();
  const options = [...new Set([...sports, ...SPORTS.filter((s) => s !== "gym")])];

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Actividad" description="Las sesiones de gym se cargan desde Entreno.">
      <div className="space-y-4 pb-2">
        {planned.map((p) => (
          <PlannedCard key={p.scheduleId} p={p} date={date} onDone={() => onOpenChange(false)} />
        ))}
        <div className="space-y-3 rounded-[16px] border border-line p-3.5">
          <p className="font-semibold">Otra actividad</p>
          <Field label="Qué hiciste">
            <Select value={sport} onChange={(e) => setSport(e.target.value as Sport)}>
              {options.map((s) => (
                <option key={s} value={s}>
                  {SPORT_INFO[s].emoji} {SPORT_INFO[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <Segmented
            label="Tipo"
            value={kind}
            onChange={setKind}
            options={[
              { value: "training", label: "Entreno / salida" },
              { value: "match", label: "Partido" },
            ]}
          />
          <Stepper label="Minutos" value={duration} onChange={setDuration} step={5} min={5} max={600} suffix="min" />
          <Segmented label="Intensidad" value={intensity} onChange={setIntensity} options={INTENSITIES.map((i) => ({ value: i.value, label: i.label }))} />
          <Button
            block
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await logActivityAction({ date, sport, kind, intensity, duration_min: duration, status: "done" });
                if (!r.ok) return void toast.error(r.error);
                onOpenChange(false);
                profeToast(r.feedback, "¡Anotado! 💪");
                router.refresh();
              })
            }
          >
            Guardar actividad
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
