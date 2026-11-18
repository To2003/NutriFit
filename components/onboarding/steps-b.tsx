"use client";
import { useState } from "react";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Chip, OptionCard, Segmented, Toggle } from "@/components/ui/choice";
import { ScheduleEditor } from "@/components/schedule/schedule-editor";
import { COOKING_TIMES, DIET_TYPES, EQUIPMENT, EXPERIENCE, FOCUSES, WEEKDAY_LABELS } from "@/lib/domain/catalog";
import type { Sport } from "@/lib/calc/types";
import { StepShell, useStepSubmit } from "./shell";
import type { OnboardingInitial } from "./types";

export function StepSchedule({ initial, sports }: { initial: OnboardingInitial["schedule"]; sports: Sport[] }) {
  const [schedule, setSchedule] = useState(initial);
  const { pending, submit } = useStepSubmit(5);
  return (
    <StepShell
      step={5}
      subtitle="Tus entrenos y partidos fijos. Si cambia (vacaciones, otro horario), lo editás desde tu perfil."
      pending={pending}
      onNext={() => submit({ schedule })}
    >
      <ScheduleEditor value={schedule} onChange={setSchedule} sportOptions={sports} />
    </StepShell>
  );
}

export function StepGym({ initial, busyDays }: { initial: OnboardingInitial["gym"]; busyDays: number[] }) {
  const [v, setV] = useState(initial);
  const { pending, submit } = useStepSubmit(6);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));
  const toggleDay = (d: number) => set("weekdays", v.weekdays.includes(d) ? v.weekdays.filter((x) => x !== d) : [...v.weekdays, d].sort());
  const toggleEq = (e: string) => set("equipment", v.equipment.includes(e) ? v.equipment.filter((x) => x !== e) : [...v.equipment, e]);
  const consecutive = v.weekdays.some((d) => v.weekdays.includes(d === 7 ? 1 : d + 1));
  return (
    <StepShell step={6} subtitle="Con esto armamos tu mesociclo de 4 semanas." pending={pending} onNext={() => submit(v)}>
      <Field label="¿Qué días podés ir?" hint="Los días con deporte también se pueden usar: lo pesado va lejos del partido.">
        <div className="grid grid-cols-7 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={v.weekdays.includes(d)}
              onClick={() => toggleDay(d)}
              className={
                v.weekdays.includes(d)
                  ? "relative h-12 rounded-[10px] bg-accent text-sm font-bold text-accent-ink"
                  : "relative h-12 rounded-[10px] border border-line bg-surface-2 text-sm font-medium"
              }
            >
              {WEEKDAY_LABELS[d].short}
              {busyDays.includes(d) ? (
                <span aria-label="tenés deporte" className="absolute top-1 right-1 size-1.5 rounded-full bg-alert" />
              ) : null}
            </button>
          ))}
        </div>
      </Field>
      <Toggle
        checked={v.allow_consecutive}
        onChange={(c) => set("allow_consecutive", c)}
        label="Permitir días de gym seguidos"
        description={
          consecutive && !v.allow_consecutive
            ? "Elegiste días seguidos: sin esto, dejamos uno de descanso entre sesiones."
            : "Por defecto dejamos al menos un día de descanso entre sesiones."
        }
      />
      <Field label="Minutos por sesión">
        <Segmented
          label="Minutos por sesión"
          value={String(v.minutes) as "45" | "60" | "75" | "90"}
          onChange={(m) => set("minutes", Number(m))}
          options={["45", "60", "75", "90"].map((m) => ({ value: m as "45" | "60" | "75" | "90", label: `${m}′` }))}
        />
      </Field>
      <Field label="¿A qué hora vas, más o menos?" hint="Para el recordatorio y para separar del deporte.">
        <Input type="time" value={v.preferred_time ?? ""} onChange={(e) => set("preferred_time", e.target.value || null)} />
      </Field>
      <Field label="Equipamiento">
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT.map((e) => (
            <Chip key={e.value} selected={v.equipment.includes(e.value)} onToggle={() => toggleEq(e.value)}>
              {e.label}
            </Chip>
          ))}
        </div>
      </Field>
      <div role="radiogroup" aria-label="Experiencia" className="space-y-2">
        <p className="text-sm font-medium text-muted">Experiencia con pesas</p>
        {EXPERIENCE.map((x) => (
          <OptionCard key={x.value} value={x.value} current={v.experience} onSelect={(e) => set("experience", e)} title={x.label} description={x.description} />
        ))}
      </div>
      <Field label="¿Alguna molestia o lesión?" hint="Ej.: tendón rotuliano derecho, hombro izquierdo. Lo tenemos en cuenta (no diagnosticamos).">
        <Textarea value={v.injuries} onChange={(e) => set("injuries", e.target.value)} maxLength={500} placeholder="Nada por ahora 🙌" />
      </Field>
    </StepShell>
  );
}

export function StepFocus({ initial }: { initial: OnboardingInitial["focus"] }) {
  const [primary, setPrimary] = useState(initial.focus_primary);
  const [secondary, setSecondary] = useState(initial.focus_secondary);
  const { pending, errors, submit } = useStepSubmit(7);
  return (
    <StepShell
      step={7}
      subtitle="Uno principal y, si querés, uno secundario."
      pending={pending}
      onNext={() => submit({ focus_primary: primary, focus_secondary: secondary })}
    >
      <div>
        <p className="mb-2 font-semibold">Principal</p>
        <div className="flex flex-wrap gap-2">
          {FOCUSES.map((f) => (
            <Chip
              key={f.value}
              selected={primary === f.value}
              onToggle={() => {
                setPrimary(f.value);
                if (secondary === f.value) setSecondary(null);
              }}
            >
              {f.emoji} {f.label}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 font-semibold">Secundario</p>
        <div className="flex flex-wrap gap-2">
          {FOCUSES.filter((f) => f.value !== primary).map((f) => (
            <Chip key={f.value} selected={secondary === f.value} onToggle={() => setSecondary(secondary === f.value ? null : f.value)}>
              {f.emoji} {f.label}
            </Chip>
          ))}
        </div>
        {errors.focus_secondary ? <p className="mt-2 text-sm text-alert">{errors.focus_secondary}</p> : null}
      </div>
    </StepShell>
  );
}

export function StepDiet({ initial }: { initial: OnboardingInitial["diet"] }) {
  const [v, setV] = useState(initial);
  const [dislikesText, setDislikesText] = useState(initial.dislikes.join(", "));
  const { pending, submit } = useStepSubmit(8);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));
  return (
    <StepShell
      step={8}
      subtitle="Para que las sugerencias del Profe sean cosas que de verdad comerías."
      pending={pending}
      onNext={() =>
        submit({
          ...v,
          dislikes: dislikesText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        })
      }
    >
      <Field label="¿Cómo comés?">
        <div className="flex flex-wrap gap-2">
          {DIET_TYPES.map((d) => (
            <Chip key={d.value} selected={v.diet_type === d.value} onToggle={() => set("diet_type", d.value)}>
              {d.label}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Comidas por día">
        <Segmented
          label="Comidas por día"
          value={String(Math.min(Math.max(v.meals_per_day, 3), 6)) as "3" | "4" | "5" | "6"}
          onChange={(m) => set("meals_per_day", Number(m))}
          options={(["3", "4", "5", "6"] as const).map((m) => ({ value: m, label: m }))}
        />
      </Field>
      <Field label="Cosas que no te gustan" hint="Separadas por coma. Ej.: hígado, berenjena, pescado.">
        <Input value={dislikesText} onChange={(e) => setDislikesText(e.target.value)} placeholder="Nada, como de todo" />
      </Field>
      <Field label="Alergias o intolerancias" hint="Privado. Solo lo usa el Profe para no sugerirte eso.">
        <Input value={v.allergies} onChange={(e) => set("allergies", e.target.value)} placeholder="Ninguna" />
      </Field>
      <div role="radiogroup" aria-label="Tiempo para cocinar" className="space-y-2">
        <p className="text-sm font-medium text-muted">Tiempo para cocinar</p>
        {COOKING_TIMES.map((c) => (
          <OptionCard key={c.value} value={c.value} current={v.cooking_time} onSelect={(x) => set("cooking_time", x)} title={c.label} description={c.description} />
        ))}
      </div>
    </StepShell>
  );
}
