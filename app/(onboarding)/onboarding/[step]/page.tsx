import { notFound, redirect } from "next/navigation";
import { getMe } from "@/lib/data/me";
import { onboardingInitial } from "@/lib/onboarding/initial";
import { TOTAL_STEPS } from "@/lib/onboarding/schemas";
import { StepBasics, StepGoal, StepLifestyle, StepSports } from "@/components/onboarding/steps-a";
import { StepDiet, StepFocus, StepGym, StepSchedule } from "@/components/onboarding/steps-b";
import { StepNotifications, StepPrivacy } from "@/components/onboarding/steps-c";
import type { Sport } from "@/lib/calc/types";

export const metadata = { title: "Arranquemos" };

export default async function OnboardingStepPage({ params }: PageProps<"/onboarding/[step]">) {
  const { step: raw } = await params;
  const step = Number(raw);
  if (!Number.isInteger(step) || step < 1 || step > TOTAL_STEPS) notFound();
  const me = await getMe();
  if (!me) redirect("/login");
  // No se puede saltear pasos sin completar
  if (!me.details.onboarded_at && step > me.details.onboarding_step) redirect(`/onboarding/${me.details.onboarding_step}`);
  const init = onboardingInitial(me);

  switch (step) {
    case 1:
      return <StepBasics initial={init.basics} />;
    case 2:
      return <StepGoal initial={init.goal} />;
    case 3:
      return <StepLifestyle initial={init.lifestyle} />;
    case 4:
      return <StepSports initial={init.sports} />;
    case 5:
      return <StepSchedule initial={init.schedule} sports={init.sports.map((s) => s.sport as Sport)} />;
    case 6:
      return <StepGym initial={init.gym} busyDays={[...new Set(init.schedule.map((s) => s.weekday))]} />;
    case 7:
      return <StepFocus initial={init.focus} />;
    case 8:
      return <StepDiet initial={init.diet} />;
    case 9:
      return <StepNotifications initial={init.notif} />;
    default:
      return <StepPrivacy initial={init.privacy} />;
  }
}
