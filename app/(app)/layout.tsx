import { requireMe } from "@/lib/data/me";
import { BottomNav } from "@/components/nav/bottom-nav";
import { AppContextProvider } from "@/components/app/app-context";
import type { Sport } from "@/lib/calc/types";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const me = await requireMe();
  return (
    <AppContextProvider
      value={{
        today: me.today,
        tz: me.tz,
        glassMl: me.details.water_glass_ml,
        bottleMl: me.details.water_bottle_ml,
        lastWeightKg: me.latestWeight ? Number(me.latestWeight.kg) : null,
        sports: me.sports.map((s) => s.sport as Sport),
        schedule: me.schedule.map((s) => ({
          scheduleId: s.id,
          weekday: s.weekday,
          sport: s.sport as Sport,
          kind: s.kind as "training" | "match",
          start_time: s.start_time,
          duration_min: s.duration_min,
          intensity: s.intensity as "light" | "moderate" | "hard",
        })),
      }}
    >
      <div className="mx-auto min-h-dvh w-full max-w-lg pb-[calc(88px+var(--safe-bottom))]">
        {children}
        <BottomNav />
      </div>
    </AppContextProvider>
  );
}
