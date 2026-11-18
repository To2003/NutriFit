"use client";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Field, Input } from "@/components/ui/field";
import { Segmented, Toggle } from "@/components/ui/choice";
import { Card } from "@/components/ui/card";
import { enablePush, isIOS, isStandalone, PUSH_REASON_COPY } from "@/lib/push/client";
import { SECTION_LABELS, type Section } from "@/lib/domain/catalog";
import { StepShell, useStepSubmit } from "./shell";
import type { OnboardingInitial } from "./types";

export function StepNotifications({ initial }: { initial: OnboardingInitial["notif"] }) {
  const [v, setV] = useState(initial);
  const iosHint = useSyncExternalStore(
    () => () => {},
    () => isIOS() && !isStandalone(),
    () => false,
  );
  const { pending, submit } = useStepSubmit(9);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));

  const next = async () => {
    let enabled = v.enabled;
    if (enabled) {
      const r = await enablePush();
      if (!r.ok) {
        enabled = false;
        toast(PUSH_REASON_COPY[r.reason]);
      }
    }
    submit({ ...v, enabled });
  };

  return (
    <StepShell step={9} subtitle="Pocos y útiles. Los podés cambiar uno por uno cuando quieras." pending={pending} onNext={next}>
      {iosHint ? (
        <Card className="border-water/40 bg-water/8">
          <p className="font-semibold">¿Estás en iPhone?</p>
          <p className="mt-1 text-sm text-muted">
            Para recibir notificaciones, agregá NutriFit a la pantalla de inicio: tocá Compartir y después “Agregar a inicio”. Necesitás iOS 16.4 o
            más nuevo. Después las activás desde Ajustes.
          </p>
        </Card>
      ) : null}
      <Card className="py-1">
        <Toggle checked={v.enabled} onChange={(c) => set("enabled", c)} label="Activar notificaciones" description="Te va a pedir permiso el navegador." />
      </Card>
      <div className={v.enabled ? "space-y-1" : "pointer-events-none space-y-1 opacity-40"}>
        <Toggle checked={v.water_on} onChange={(c) => set("water_on", c)} label="Agua 💧" description="Un recordatorio cada tanto entre las 9 y las 21." />
        {v.water_on ? (
          <Segmented
            label="Cada cuántas horas"
            value={String(v.water_every_h) as "1" | "2" | "3"}
            onChange={(h) => set("water_every_h", Number(h))}
            options={[
              { value: "1", label: "Cada 1 h" },
              { value: "2", label: "Cada 2 h" },
              { value: "3", label: "Cada 3 h" },
            ]}
          />
        ) : null}
        <Toggle checked={v.meals_on} onChange={(c) => set("meals_on", c)} label="Comidas" description="Si a las 14:30 no cargaste el almuerzo (o a las 22 la cena)." />
        <Toggle checked={v.gym_on} onChange={(c) => set("gym_on", c)} label="Gym" description="El día que te toca, a tu hora." />
        <Toggle checked={v.daily_close_on} onChange={(c) => set("daily_close_on", c)} label="Cierre del día" description="El Profe te hace el balance del día." />
        {v.daily_close_on ? (
          <Field label="¿A qué hora?">
            <Input type="time" value={v.daily_close_at} onChange={(e) => set("daily_close_at", e.target.value)} />
          </Field>
        ) : null}
        <Toggle checked={v.weekly_review} onChange={(c) => set("weekly_review", c)} label="Revisión semanal" description="Domingo a la noche: tendencia, objetivos y ajustes." />
      </div>
    </StepShell>
  );
}

export function StepPrivacy({ initial }: { initial: OnboardingInitial["privacy"] }) {
  const [v, setV] = useState(initial);
  const { pending, errors, submit } = useStepSubmit(10);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));
  const sections: { key: Section; field: keyof typeof v }[] = [
    { key: "streaks", field: "show_streaks" },
    { key: "training", field: "show_training" },
    { key: "tests", field: "show_tests" },
    { key: "meals", field: "show_meals" },
    { key: "body", field: "show_body" },
  ];
  return (
    <StepShell step={10} subtitle="Vos decidís qué ve cada uno. Se aplica en la base de datos, no solo en la pantalla." pending={pending} onNext={() => submit(v)} nextLabel="Ver mis objetivos">
      <Segmented
        label="Tipo de cuenta"
        value={v.is_private ? "private" : "public"}
        onChange={(x) => set("is_private", x === "private")}
        options={[
          { value: "public", label: "Pública" },
          { value: "private", label: "Privada" },
        ]}
      />
      <p className="text-sm text-muted">
        {v.is_private
          ? "Te tienen que mandar solicitud y vos aceptás quién te sigue."
          : "Cualquiera con cuenta te puede seguir y ver lo que dejes visible."}
      </p>
      <Card className="py-1">
        <p className="pt-2 text-sm font-medium text-muted">Qué se ve en tu perfil</p>
        {sections.map((s) => (
          <Toggle key={s.key} checked={Boolean(v[s.field])} onChange={(c) => set(s.field, c as never)} label={SECTION_LABELS[s.key]} />
        ))}
      </Card>
      <Card>
        <p className="font-semibold">Sobre el Profe (la IA)</p>
        <p className="mt-1 text-sm text-muted">
          El Profe usa el plan gratis de Gemini, de Google. En ese plan, Google puede usar lo que le mandamos para mejorar sus productos. Nunca le
          mandamos tu nombre ni tu mail: solo números del día, tus objetivos y lo que cargás. NutriFit no reemplaza a un médico, nutricionista ni
          deportólogo.
        </p>
        <Toggle checked={v.ai_notice} onChange={(c) => set("ai_notice", c)} label="Entendido, dale" />
        {errors.ai_notice ? <p className="text-sm text-alert">{errors.ai_notice}</p> : null}
      </Card>
    </StepShell>
  );
}
