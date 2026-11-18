import { notFound } from "next/navigation";
import { requireMe } from "@/lib/data/me";
import { onboardingInitial } from "@/lib/onboarding/initial";
import { goalsView } from "@/lib/data/goals-view";
import { StepBasics, StepGoal, StepLifestyle, StepSports } from "@/components/onboarding/steps-a";
import { StepDiet, StepFocus, StepGym, StepSchedule } from "@/components/onboarding/steps-b";
import { StepNotifications, StepPrivacy } from "@/components/onboarding/steps-c";
import { SettingsModeProvider } from "@/components/onboarding/shell";
import { GoalsBoard } from "@/components/goals/goals-board";
import { saveGoals } from "@/app/(onboarding)/onboarding/actions";
import { BackHeader } from "@/components/profile/back-header";
import type { Sport } from "@/lib/calc/types";

export default async function AjustesPage({ params }: PageProps<"/perfil/ajustes/[seccion]">) {
  const { seccion } = await params;
  const me = await requireMe();
  const init = onboardingInitial(me);

  if (seccion === "objetivos") {
    const view = goalsView(me);
    if (!view) notFound();
    return (
      <main className="px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <BackHeader title="Tus objetivos" />
        <GoalsBoard auto={view.auto} current={view.current} manualInitially={view.manual} explanation={view.explanation} onSave={saveGoals} saveLabel="Guardar" redirectTo="/perfil" />
      </main>
    );
  }

  const content = (() => {
    switch (seccion) {
      case "datos":
        return <StepBasics initial={init.basics} />;
      case "objetivo":
        return <StepGoal initial={init.goal} />;
      case "estilo":
        return <StepLifestyle initial={init.lifestyle} />;
      case "deportes":
        return <StepSports initial={init.sports} />;
      case "agenda":
        return <StepSchedule initial={init.schedule} sports={init.sports.map((s) => s.sport as Sport)} />;
      case "gimnasio":
        return <StepGym initial={init.gym} busyDays={[...new Set(init.schedule.map((s) => s.weekday))]} />;
      case "foco":
        return <StepFocus initial={init.focus} />;
      case "alimentacion":
        return <StepDiet initial={init.diet} />;
      case "notificaciones":
        return <StepNotifications initial={init.notif} />;
      case "privacidad":
        return <StepPrivacy initial={init.privacy} />;
      default:
        return null;
    }
  })();
  if (!content) notFound();
  return <SettingsModeProvider>{content}</SettingsModeProvider>;
}
