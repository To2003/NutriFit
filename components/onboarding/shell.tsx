"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ProgressSteps } from "@/components/ui/meters";
import { Button } from "@/components/ui/button";
import { saveOnboardingStep } from "@/app/(onboarding)/onboarding/actions";
import { STEP_TITLES, TOTAL_STEPS, type StepNumber } from "@/lib/onboarding/schemas";

export function useStepSubmit(step: number, nextHref?: string) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = (payload: unknown) =>
    start(async () => {
      const r = await saveOnboardingStep(step, payload);
      if (!r.ok) {
        setErrors(r.fields ?? {});
        toast.error(r.error);
        return;
      }
      setErrors({});
      router.push(nextHref ?? (step >= TOTAL_STEPS ? "/onboarding/objetivos" : `/onboarding/${step + 1}`));
    });
  return { pending, errors, submit };
}

export function StepShell({
  step,
  subtitle,
  children,
  onNext,
  pending,
  nextLabel = "Seguir",
  canSkip,
  onSkip,
}: {
  step: number;
  subtitle?: string;
  children: React.ReactNode;
  onNext: () => void;
  pending: boolean;
  nextLabel?: string;
  canSkip?: boolean;
  onSkip?: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pt-[max(16px,env(safe-area-inset-top))]">
      <div className="flex items-center gap-2 py-2">
        {step > 1 ? (
          <Link
            href={`/onboarding/${step - 1}`}
            aria-label="Volver al paso anterior"
            className="-ml-2 grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2"
          >
            <ChevronLeft className="size-6" />
          </Link>
        ) : (
          <span className="size-10" />
        )}
        <div className="flex-1">
          <ProgressSteps step={step} total={TOTAL_STEPS} />
        </div>
        <span className="tnum w-10 text-right text-sm text-muted">
          {step}/{TOTAL_STEPS}
        </span>
      </div>
      <motion.div
        key={step}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className="flex flex-1 flex-col"
      >
        <header className="pt-4 pb-6">
          <h1 className="score text-[44px] text-text">{STEP_TITLES[step as StepNumber]}</h1>
          {subtitle ? <p className="mt-2 text-muted">{subtitle}</p> : null}
        </header>
        <form
          className="flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            onNext();
          }}
        >
          <div className="flex-1 space-y-5 pb-6">{children}</div>
          <div className="sticky bottom-0 -mx-5 flex flex-col gap-2 bg-gradient-to-t from-bg via-bg to-transparent px-5 pt-6 pb-[max(20px,env(safe-area-inset-bottom))]">
            <Button type="submit" size="lg" block disabled={pending}>
              {pending ? "Guardando…" : nextLabel}
            </Button>
            {canSkip ? (
              <Button type="button" variant="ghost" size="sm" onClick={onSkip} disabled={pending}>
                Ahora no
              </Button>
            ) : null}
          </div>
        </form>
      </motion.div>
    </div>
  );
}
