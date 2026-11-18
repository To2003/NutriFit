import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getMe } from "@/lib/data/me";
import { goalsView } from "@/lib/data/goals-view";
import { GoalsBoard } from "@/components/goals/goals-board";
import { finishOnboarding } from "../actions";

export const metadata = { title: "Tus objetivos" };

export default async function ObjetivosOnboardingPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.details.onboarding_step <= 10 && !me.details.onboarded_at) redirect(`/onboarding/${Math.max(me.details.onboarding_step, 1)}`);
  const view = goalsView(me);
  if (!view) redirect("/onboarding/1");
  return (
    <div className="mx-auto w-full max-w-lg px-5 pt-[max(16px,env(safe-area-inset-top))]">
      <div className="py-2">
        <Link href="/onboarding/10" aria-label="Volver" className="-ml-2 grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2">
          <ChevronLeft className="size-6" />
        </Link>
      </div>
      <header className="pt-2 pb-5">
        <h1 className="score text-[32px]">Tus objetivos</h1>
        <p className="mt-2 text-muted">Cambian según el día: más nafta cuando hay partido, menos cuando descansás.</p>
      </header>
      <GoalsBoard
        auto={view.auto}
        current={view.current}
        manualInitially={view.manual}
        explanation={view.explanation}
        onSave={finishOnboarding}
        saveLabel="Arrancar"
        redirectTo="/inicio"
      />
    </div>
  );
}
