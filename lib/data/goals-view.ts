import "server-only";
import { explainTargets } from "@/lib/calc/explain";
import type { Me } from "@/lib/data/me";
import { buildTargetInputs, computeWeek, parseStored, weekToStored, type StoredTargets } from "@/lib/data/targets";
import type { TargetNote } from "@/lib/calc/types";

export function goalsView(me: Me): { auto: StoredTargets; current: StoredTargets | null; manual: boolean; explanation: string[] } | null {
  const inputs = buildTargetInputs({
    details: me.details,
    weightKg: me.latestWeight?.kg,
    schedule: me.schedule,
    gym: me.gym,
    goals: me.goals,
  });
  if (!inputs) return null;
  const week = computeWeek(inputs);
  const auto = weekToStored(week);
  const notes = [...new Set(Object.values(week.days).flatMap((d) => d.notes))] as TargetNote[];
  return {
    auto,
    current: parseStored(me.goals?.targets),
    manual: Boolean(me.goals?.manual_override),
    explanation: explainTargets({
      goal: inputs.goal,
      pace: inputs.pace,
      weightKg: inputs.body.weightKg,
      bmrKcal: week.days[1].bmrKcal,
      notes,
      byTypeKcal: { rest: auto.rest?.kcal, training: auto.training?.kcal, match: auto.match?.kcal },
    }),
  };
}
