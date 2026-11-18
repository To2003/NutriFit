"use client";
import { PlannedCard } from "@/components/diary/activity-sheet";
import type { PlannedActivity } from "@/lib/data/day";

export function PlannedCardList({ planned, date }: { planned: PlannedActivity[]; date: string }) {
  if (planned.length === 0) return null;
  return (
    <div className="space-y-2">
      {planned.map((p) => (
        <PlannedCard
          key={p.scheduleId}
          date={date}
          p={{ scheduleId: p.scheduleId, sport: p.sport, kind: p.kind, start_time: p.start_time, duration_min: p.duration_min, intensity: p.intensity }}
        />
      ))}
    </div>
  );
}
