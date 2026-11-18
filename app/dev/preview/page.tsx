import { notFound } from "next/navigation";
import { Scoreboard } from "@/components/home/scoreboard";
import { WaterCard } from "@/components/home/water-card";
import { WeightChart } from "@/components/home/weight-chart";
import { Section } from "@/components/home/section";
import { GoalsBoard } from "@/components/goals/goals-board";
import { ProfeBubble } from "@/components/ui/profe";
import { ProgramView } from "@/components/training/program-view";
import { AppContextProvider } from "@/components/app/app-context";
import { BottomNav } from "@/components/nav/bottom-nav";
import { WeeklyCard, DailyCloseCard } from "@/components/home/review-cards";
import { saveGoals } from "@/app/(onboarding)/onboarding/actions";
import { StepGym } from "@/components/onboarding/steps-b";
import { GymMode } from "@/components/training/gym-mode";
import { EXERCISE_TEXT } from "@/lib/training/library-data";
import { generateRulePlan } from "@/lib/training/templates";
import { EXERCISE_LIBRARY, LIBRARY_BY_ID } from "@/lib/training/library-data";
import { weekToStored, computeWeek } from "@/lib/data/targets";
import { explainTargets } from "@/lib/calc/explain";
import { addDays } from "@/lib/dates";

/** Solo desarrollo: muestra los componentes con datos de ejemplo (agenda de Toto). */
export default async function Preview({ searchParams }: PageProps<"/dev/preview">) {
  if (process.env.NODE_ENV === "production") notFound();
  const view = (await searchParams).v ?? "home";
  const schedule = [
    { weekday: 2, sport: "volleyball" as const, kind: "training" as const, intensity: "moderate" as const, durationMin: 120 },
    { weekday: 3, sport: "field_hockey" as const, kind: "training" as const, intensity: "moderate" as const, durationMin: 90 },
    { weekday: 4, sport: "volleyball" as const, kind: "training" as const, intensity: "moderate" as const, durationMin: 120 },
    { weekday: 5, sport: "field_hockey" as const, kind: "training" as const, intensity: "moderate" as const, durationMin: 90 },
    { weekday: 6, sport: "volleyball" as const, kind: "match" as const, intensity: "hard" as const, durationMin: 120 },
    { weekday: 7, sport: "field_hockey" as const, kind: "match" as const, intensity: "hard" as const, durationMin: 70 },
  ];
  const inputs = { body: { sex: "male" as const, ageYears: 23, heightCm: 185, weightKg: 85 }, goal: "lose_fat" as const, pace: "moderate" as const, lifestyle: "mixed" as const, schedule, gym: { weekdays: [1, 3, 5], minutes: 60 }, expenditureOffsetKcal: 0 };
  const week = computeWeek(inputs);
  const auto = weekToStored(week);
  const today = "2026-11-21";
  const weights = Array.from({ length: 40 }, (_, i) => ({ date: addDays(today, -39 + i), kg: 86 - i * 0.06 + Math.sin(i * 1.7) * 0.4 }));
  const plan = generateRulePlan(
    { gymDays: [1, 3, 5], minutes: 60, experience: "intermediate", equipment: ["full_gym"], injuries: "", focusPrimary: "jump", focusSecondary: "injury_prevention", events: schedule, allowConsecutive: false, sports: ["volleyball", "field_hockey"] },
    EXERCISE_LIBRARY,
  );
  const sessions = [1, 2, 3, 4].flatMap((w) =>
    plan.sessions.map((s, i) => ({
      id: `${w}-${i}`,
      week: w,
      weekday: s.weekday,
      name: s.name,
      isDeload: w === 4,
      exercises: s.exercises.map((e, j) => ({ ...e, id: `${w}-${i}-${j}`, name: LIBRARY_BY_ID[e.exerciseId].name, alternatives: [] })),
    })),
  );

  if (view === "onb")
    return <StepGym initial={{ weekdays: [1, 3, 5], minutes: 60, preferred_time: "08:00", equipment: ["full_gym"], experience: "intermediate", injuries: "", allow_consecutive: false }} busyDays={[2, 3, 4, 5, 6, 7]} />;
  if (view === "gym") {
    const s = plan.sessions.find((x) => x.weekday === 3)!;
    return (
      <GymMode
        programSessionId="00000000-0000-4000-8000-000000000000"
        title={s.name}
        exercises={s.exercises.map((e, i) => ({
          ...e,
          name: LIBRARY_BY_ID[e.exerciseId].name,
          instructions: EXERCISE_TEXT[e.exerciseId].instructions,
          mistakes: EXERCISE_TEXT[e.exerciseId].mistakes,
          loadType: LIBRARY_BY_ID[e.exerciseId].load_type,
          suggestedKg: i === 1 ? 100 : null,
          suggestionReason: i === 1 ? "Completaste el rango la vez pasada: subí a 100 kg 💪" : "",
          previous: i === 1 ? [{ kg: 95, reps: 6, rir: 2 }, { kg: 95, reps: 6, rir: 2 }, { kg: 95, reps: 6, rir: 1 }] : [],
        }))}
      />
    );
  }

  return (
    <AppContextProvider value={{ today, tz: "America/Argentina/Buenos_Aires", glassMl: 250, bottleMl: 500, lastWeightKg: 85, sports: ["volleyball", "field_hockey"], schedule: [] }}>
      <div className="mx-auto min-h-dvh w-full max-w-lg space-y-3 px-4 pt-5 pb-28">
        {view === "home" ? (
          <>
            <header className="px-1 pb-1">
              <p className="text-sm text-muted">Sábado 21 de noviembre</p>
              <h1 className="score text-[40px]">Buenas tardes, Toto</h1>
            </header>
            <Scoreboard dayType="match" kcal={1840} target={auto.match!.kcal} protein={[118, auto.match!.protein_g]} carbs={[210, auto.match!.carbs_g]} fat={[52, auto.match!.fat_g]} />
            <WaterCard ml={1750} target={auto.match!.water_ml} date={today} />
            <Section title="Peso" href="#" linkLabel="Medidas y tests">
              <WeightChart weights={weights} today={today} />
            </Section>
            <DailyCloseCard close={{ resumen: "Llegaste al 92 % de las kcal y al 85 % de la proteína. Agua al día.", bien: "Cargaste todas las comidas antes del partido.", ajuste: "Mañana sumá un yogur proteico en la merienda." }} canGenerate={false} />
            <WeeklyCard review={{ text: "Tendencia: 84,3 kg (−0,4 en la semana). Cargaste 6 de 7 días. Hiciste 3 de 3 sesiones y rompiste récord en sentadilla." }} goals={[{ id: "a", text: "Llegar a la proteína 5 de 7 días", done: true }, { id: "b", text: "Cumplir el agua 5 días", done: false }, { id: "c", text: "Dormir 8 h antes de los partidos", done: false }]} proposal={{ id: "x", previous: 3020, observed: 3240, proposed: 3130 }} canGenerate={false} />
            <ProfeBubble>Día de partido: sumá carbos (arroz, fideos, pan) para llegar con nafta 🏆</ProfeBubble>
          </>
        ) : view === "goals" ? (
          <GoalsBoard
            auto={auto}
            current={null}
            manualInitially={false}
            explanation={explainTargets({ goal: "lose_fat", pace: "moderate", weightKg: 85, bmrKcal: week.days[1].bmrKcal, notes: [], byTypeKcal: { rest: auto.rest?.kcal, training: auto.training?.kcal, match: auto.match?.kcal } })}
            onSave={saveGoals}
            saveLabel="Arrancar"
          />
        ) : (
          <ProgramView programId="x" weeks={4} currentWeek={1} todayWeekday={3} sessions={sessions} doneSessionIds={[]} />
        )}
      </div>
      <BottomNav />
    </AppContextProvider>
  );
}
