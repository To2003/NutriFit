import { requireMe } from "@/lib/data/me";
import { loadDay } from "@/lib/data/day";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatDayLong, isoWeekday, timeInTz, weekStart } from "@/lib/dates";
import { DailyCloseCard, WeeklyCard } from "@/components/home/review-cards";
import { Scoreboard } from "@/components/home/scoreboard";
import { WaterCard } from "@/components/home/water-card";
import { WeightChart } from "@/components/home/weight-chart";
import { AgentCard } from "@/components/home/agent-card";
import { Section } from "@/components/home/section";
import { TrainingToday } from "@/components/home/training-today";
import { StreaksCard } from "@/components/home/streaks-card";
import { PerformanceCard } from "@/components/home/performance-card";
import { PlannedCardList } from "@/components/home/planned-list";
import { Empty } from "@/components/ui/empty";

export const metadata = { title: "Inicio" };

export default async function InicioPage() {
  const me = await requireMe();
  const supabase = await createClient();
  const ws = weekStart(me.today);
  const reviewedWs = isoWeekday(me.today) === 7 ? ws : addDays(ws, -7);
  const [day, weights, lastMsg, close, review, goals, proposal] = await Promise.all([
    loadDay(supabase, me, me.today),
    supabase
      .from("weight_logs")
      .select("log_date, kg")
      .eq("user_id", me.userId)
      .gte("log_date", addDays(me.today, -120))
      .order("log_date"),
    supabase
      .from("agent_messages")
      .select("content, created_at, kind")
      .eq("user_id", me.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("agent_messages").select("content").eq("user_id", me.userId).eq("kind", "daily_close").eq("for_date", me.today).maybeSingle(),
    supabase.from("agent_messages").select("content, for_date").eq("user_id", me.userId).eq("kind", "weekly_review").gte("for_date", addDays(ws, -7)).order("for_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("weekly_goals").select("id, text, done").eq("user_id", me.userId).eq("week_start", isoWeekday(me.today) === 7 ? addDays(ws, 7) : ws).order("created_at"),
    supabase.from("tdee_proposals").select("*").eq("user_id", me.userId).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const t = day.targets;
  const nowHm = timeInTz(me.tz);
  const hello = new Date().toLocaleString("es-AR", { hour: "numeric", hour12: false, timeZone: me.tz });
  const h = Number(hello);
  const greet = h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
  const msgText = lastMsg.data ? String((lastMsg.data.content as { text?: string })?.text ?? "") : "";

  return (
    <main className="space-y-3 px-4 pt-[max(18px,env(safe-area-inset-top))]">
      <header className="px-1 pb-1">
        <p className="text-sm text-muted first-letter:uppercase">{formatDayLong(me.today)}</p>
        <h1 className="score text-[40px]">
          {greet}
          {me.profile.display_name ? `, ${me.profile.display_name.split(" ")[0]}` : ""}
        </h1>
      </header>

      {t ? (
        <Scoreboard
          dayType={t.dayType}
          kcal={day.totals.kcal}
          target={t.kcal}
          protein={[day.totals.protein_g, t.proteinG]}
          carbs={[day.totals.carbs_g, t.carbsG]}
          fat={[day.totals.fat_g, t.fatG]}
        />
      ) : (
        <Empty title="Faltan datos para tus objetivos">Completá tu perfil y los calculamos.</Empty>
      )}

      <PlannedCardList planned={day.planned.filter((p) => p.status === "pending" && (!p.start_time || p.start_time.slice(0, 5) <= nowHm))} date={me.today} />

      {t ? <WaterCard ml={day.waterMl} target={t.waterMl} date={me.today} /> : null}

      <TrainingToday me={me} />

      <Section title="Peso" href="/perfil/progreso" linkLabel="Medidas y tests">
        <WeightChart weights={(weights.data ?? []).map((w) => ({ date: w.log_date, kg: Number(w.kg) }))} today={me.today} />
      </Section>

      <StreaksCard userId={me.userId} />

      <PerformanceCard me={me} />

      <DailyCloseCard close={(close.data?.content as { resumen: string; bien: string; ajuste: string } | undefined) ?? null} canGenerate={nowHm >= "19:00" && day.meals.length > 0} />

      <WeeklyCard
        review={(review.data?.content as { text: string } | undefined) ?? null}
        goals={goals.data ?? []}
        proposal={proposal.data ? { id: proposal.data.id, previous: Number(proposal.data.previous_tdee), observed: Number(proposal.data.observed_tdee), proposed: Number(proposal.data.proposed_tdee) } : null}
        canGenerate={!review.data && (isoWeekday(me.today) === 7 || isoWeekday(me.today) === 1) && reviewedWs <= me.today}
      />

      {msgText ? <AgentCard text={msgText} /> : <AgentCard text="Cargá tu primera comida y te tiro una mano. Sin retos, prometido." />}
    </main>
  );
}
