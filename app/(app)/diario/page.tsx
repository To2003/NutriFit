import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireMe } from "@/lib/data/me";
import { loadDay } from "@/lib/data/day";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatDayLong } from "@/lib/dates";
import { MealList, ActivityRow, type MealView } from "@/components/diary/meal-list";
import { PlannedCardList } from "@/components/home/planned-list";
import { WaterCard } from "@/components/home/water-card";
import { MacroBar } from "@/components/ui/meters";
import { SuggestButton } from "@/components/agent/suggest-button";
import { DAY_TYPE_INFO, INTENSITIES, SPORT_INFO } from "@/lib/domain/catalog";
import { fmt, fmt1 } from "@/lib/utils";

export const metadata = { title: "Diario" };

export default async function DiarioPage({ searchParams }: PageProps<"/diario">) {
  const me = await requireMe();
  const sp = await searchParams;
  const raw = typeof sp.date === "string" ? sp.date : null;
  const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= me.today ? raw : me.today;
  const isToday = date === me.today;
  const supabase = await createClient();
  const day = await loadDay(supabase, me, date);
  const t = day.targets;

  const meals: MealView[] = day.meals.map((m) => ({
    id: m.id,
    meal: m.meal,
    origin: m.origin,
    hasPhoto: Boolean(m.photo_path),
    kcal: m.kcal,
    protein_g: m.protein_g,
    carbs_g: m.carbs_g,
    fat_g: m.fat_g,
    items: m.items.map((i) => ({ id: i.id, name: i.name, grams: Number(i.grams), kcal: Number(i.kcal), source: i.source })),
  }));

  return (
    <main className="space-y-3 px-4 pt-[max(18px,env(safe-area-inset-top))]">
      <header className="flex items-center gap-1">
        <Link href={`/diario?date=${addDays(date, -1)}`} aria-label="Día anterior" className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2">
          <ChevronLeft className="size-6" />
        </Link>
        <div className="flex-1 text-center">
          <p className="text-sm text-muted first-letter:uppercase">{isToday ? "Hoy" : formatDayLong(date)}</p>
          <h1 className="score text-2xl leading-none">{t ? `${DAY_TYPE_INFO[t.dayType].label} ${DAY_TYPE_INFO[t.dayType].emoji}` : "Diario"}</h1>
        </div>
        {isToday ? (
          <span className="size-11" />
        ) : (
          <Link href={`/diario?date=${addDays(date, 1)}`} aria-label="Día siguiente" className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2">
            <ChevronRight className="size-6" />
          </Link>
        )}
      </header>

      {t ? (
        <section className="rounded-[20px] border border-line bg-surface p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="score text-[30px]">
              {fmt(day.totals.kcal)}
              <span className="font-sans text-base font-normal text-muted"> / {fmt(t.kcal)} kcal</span>
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MacroBar label="Proteína" value={day.totals.protein_g} target={t.proteinG} color="var(--protein)" />
            <MacroBar label="Carbos" value={day.totals.carbs_g} target={t.carbsG} color="var(--carbs)" />
            <MacroBar label="Grasa" value={day.totals.fat_g} target={t.fatG} color="var(--fat)" />
          </div>
        </section>
      ) : null}

      {isToday ? <SuggestButton /> : null}

      <MealList meals={meals} />

      {t ? <WaterCard ml={day.waterMl} target={t.waterMl} date={date} /> : null}

      <PlannedCardList planned={day.planned.filter((p) => p.status === "pending")} date={date} />

      {day.planned.some((p) => p.status !== "pending") || day.extraActivities.length || day.workouts.length ? (
        <section className="rounded-[20px] border border-line bg-surface p-4">
          <h2 className="mb-1 font-semibold">Actividad</h2>
          <ul className="divide-y divide-line">
            {day.planned
              .filter((p) => p.status !== "pending" && p.log)
              .map((p) => (
                <ActivityRow
                  key={p.scheduleId}
                  id={p.log!.id}
                  label={`${SPORT_INFO[p.sport].emoji} ${SPORT_INFO[p.sport].label}${p.kind === "match" ? " (partido)" : ""}`}
                  detail={p.status === "skipped" ? "No fue" : `${p.log!.duration_min} min · ${INTENSITIES.find((i) => i.value === p.log!.intensity)?.label} · ${fmt(Number(p.log!.kcal ?? 0))} kcal`}
                />
              ))}
            {day.extraActivities.map((a) => (
              <ActivityRow
                key={a.id}
                id={a.id}
                label={`${SPORT_INFO[a.sport as keyof typeof SPORT_INFO]?.emoji ?? "✨"} ${SPORT_INFO[a.sport as keyof typeof SPORT_INFO]?.label ?? a.sport}`}
                detail={`${a.duration_min} min · ${fmt(Number(a.kcal ?? 0))} kcal`}
              />
            ))}
            {day.workouts
              .filter((w) => w.ended_at)
              .map((w) => (
                <li key={w.id} className="py-2">
                  🏋️ Gimnasio
                  <span className="block text-xs text-muted">
                    {w.duration_min} min · {fmt(Number(w.volume_kg ?? 0))} kg de volumen
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {day.weightKg ? (
        <p className="px-1 text-sm text-muted">
          Peso del día: <span className="font-semibold text-text">{fmt1(day.weightKg)} kg</span>
        </p>
      ) : null}
    </main>
  );
}
