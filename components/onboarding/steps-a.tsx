"use client";
import { useState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { Chip, OptionCard, Segmented } from "@/components/ui/choice";
import { GOALS, LEVELS, LIFESTYLES, ONBOARDING_SPORTS, PACES, SPORT_INFO } from "@/lib/domain/catalog";
import { MIN_AGE } from "@/lib/onboarding/schemas";
import { ageFromBirthdate } from "@/lib/calc/bmr";
import type { Sport } from "@/lib/calc/types";
import { StepShell, useStepSubmit } from "./shell";
import type { OnboardingInitial } from "./types";

export function StepBasics({ initial }: { initial: OnboardingInitial["basics"] }) {
  const [v, setV] = useState(initial);
  const { pending, errors, submit } = useStepSubmit(1);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));
  const underage = v.birthdate.length === 10 && ageFromBirthdate(v.birthdate) < MIN_AGE;
  return (
    <StepShell
      step={1}
      subtitle="Con esto calculamos tu gasto. Tu fecha de nacimiento, sexo, altura y peso son privados."
      pending={pending}
      onNext={() => submit(v)}
    >
      <Field label="¿Cómo te llamamos?" htmlFor="display_name" error={errors.display_name}>
        <Input id="display_name" autoComplete="given-name" value={v.display_name} onChange={(e) => set("display_name", e.target.value)} />
      </Field>
      <Field label="Tu usuario" htmlFor="username" hint="Así te encuentran tus amigos." error={errors.username}>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">@</span>
          <Input
            id="username"
            className="pl-8"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={v.username}
            onChange={(e) => set("username", e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
          />
        </div>
      </Field>
      <Field
        label="Fecha de nacimiento"
        htmlFor="birthdate"
        error={errors.birthdate ?? (underage ? `Por ahora NutriFit es solo para mayores de ${MIN_AGE}.` : undefined)}
      >
        <Input id="birthdate" type="date" value={v.birthdate} onChange={(e) => set("birthdate", e.target.value)} />
      </Field>
      <Field label="Sexo (para las fórmulas de gasto)" error={errors.sex}>
        <Segmented
          label="Sexo"
          value={(v.sex || "none") as "male" | "female" | "none"}
          onChange={(s) => set("sex", s as "male" | "female")}
          options={[
            { value: "male", label: "Masculino" },
            { value: "female", label: "Femenino" },
          ]}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Altura (cm)" htmlFor="height" error={errors.height_cm}>
          <Input id="height" inputMode="numeric" value={v.height_cm} onChange={(e) => set("height_cm", e.target.value.replace(",", "."))} />
        </Field>
        <Field label="Peso (kg)" htmlFor="weight" error={errors.weight_kg}>
          <Input id="weight" inputMode="decimal" value={v.weight_kg} onChange={(e) => set("weight_kg", e.target.value.replace(",", "."))} />
        </Field>
      </div>
    </StepShell>
  );
}

export function StepGoal({ initial }: { initial: OnboardingInitial["goal"] }) {
  const [goal, setGoal] = useState(initial.goal);
  const [pace, setPace] = useState(initial.pace);
  const { pending, submit } = useStepSubmit(2);
  return (
    <StepShell step={2} subtitle="Podés cambiarlo cuando quieras desde tu perfil." pending={pending} onNext={() => submit({ goal, pace })}>
      <div role="radiogroup" aria-label="Objetivo" className="space-y-2">
        {GOALS.map((g) => (
          <OptionCard key={g.value} value={g.value} current={goal as typeof g.value} onSelect={setGoal} title={g.label} description={g.description} icon={g.emoji} />
        ))}
      </div>
      {goal === "lose_fat" ? (
        <div>
          <p className="mb-2 font-semibold">¿A qué ritmo?</p>
          <div role="radiogroup" aria-label="Ritmo" className="space-y-2">
            {PACES.map((p) => (
              <OptionCard key={p.value} value={p.value} current={pace} onSelect={setPace} title={p.label} description={p.description} />
            ))}
          </div>
        </div>
      ) : null}
    </StepShell>
  );
}

export function StepLifestyle({ initial }: { initial: string | null }) {
  const [lifestyle, setLifestyle] = useState(initial);
  const { pending, submit } = useStepSubmit(3);
  return (
    <StepShell step={3} subtitle="Sin contar entrenos ni partidos: eso lo cargamos aparte." pending={pending} onNext={() => submit({ lifestyle })}>
      <div role="radiogroup" aria-label="Estilo de vida" className="space-y-2">
        {LIFESTYLES.map((l) => (
          <OptionCard key={l.value} value={l.value} current={lifestyle as typeof l.value} onSelect={setLifestyle} title={l.label} description={l.description} />
        ))}
      </div>
    </StepShell>
  );
}

export function StepSports({ initial }: { initial: OnboardingInitial["sports"] }) {
  const [sports, setSports] = useState(initial);
  const { pending, submit } = useStepSubmit(4);
  const has = (s: Sport) => sports.some((x) => x.sport === s);
  const toggle = (s: Sport) =>
    setSports((cur) => (has(s) ? cur.filter((x) => x.sport !== s) : [...cur, { sport: s, position: null, level: "amateur" }]));
  const update = (s: Sport, patch: Partial<(typeof sports)[number]>) =>
    setSports((cur) => cur.map((x) => (x.sport === s ? { ...x, ...patch } : x)));
  return (
    <StepShell step={4} subtitle="Elegí todos los que hagas. La rutina se arma pensando en esto." pending={pending} onNext={() => submit({ sports })}>
      <div className="flex flex-wrap gap-2">
        {ONBOARDING_SPORTS.map((s) => (
          <Chip key={s} selected={has(s)} onToggle={() => toggle(s)}>
            {SPORT_INFO[s].emoji} {SPORT_INFO[s].label}
          </Chip>
        ))}
      </div>
      {sports.map((s) => {
        const info = SPORT_INFO[s.sport];
        return (
          <div key={s.sport} className="space-y-3 rounded-[18px] border border-line bg-surface p-4">
            <p className="font-semibold">
              {info.emoji} {info.label}
            </p>
            {info.positions ? (
              <Field label="Posición">
                <Select value={s.position ?? ""} onChange={(e) => update(s.sport, { position: e.target.value || null })}>
                  <option value="">Sin posición fija</option>
                  {info.positions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Nivel">
              <Select value={s.level} onChange={(e) => update(s.sport, { level: e.target.value as typeof s.level })}>
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        );
      })}
    </StepShell>
  );
}
