import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { requireMe } from "@/lib/data/me";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/profile/avatar";
import { FollowControls } from "@/components/profile/follow-button";
import { BackHeader } from "@/components/profile/back-header";
import { Section } from "@/components/home/section";
import { WeightChart } from "@/components/home/weight-chart";
import { SPORT_INFO, SECTION_LABELS, WEEKDAY_LABELS, MEALS } from "@/lib/domain/catalog";
import { LIBRARY_BY_ID } from "@/lib/training/library-data";
import { TEST_INFO } from "@/lib/domain/tests";
import { addDays, formatDayShort } from "@/lib/dates";
import { fmt1 } from "@/lib/utils";
import type { Sport } from "@/lib/calc/types";

export default async function PublicProfilePage({ params }: PageProps<"/perfil/[username]">) {
  const { username } = await params;
  const me = await requireMe();
  const supabase = await createClient();
  const prof = await supabase.from("profiles").select("*").ilike("username", username).maybeSingle();
  if (!prof.data) notFound();
  const p = prof.data;
  const isMe = p.id === me.userId;
  if (!isMe && /^user_[0-9a-f]{12}$/.test(p.username)) notFound();

  // Lo que se puede ver lo decide la base (RLS + can_view_section). Esto solo arma la UI.
  const [sectionsRes, sports, myFollow, theirFollow, myBlock, followers, following] = await Promise.all([
    supabase.rpc("visible_sections", { owner: p.id }),
    supabase.from("user_sports").select("*").eq("user_id", p.id),
    supabase.from("follows").select("status").eq("follower_id", me.userId).eq("following_id", p.id).maybeSingle(),
    supabase.from("follows").select("status").eq("follower_id", p.id).eq("following_id", me.userId).eq("status", "accepted").maybeSingle(),
    supabase.from("blocks").select("blocked_id").eq("blocker_id", me.userId).eq("blocked_id", p.id).maybeSingle(),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", p.id).eq("status", "accepted"),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", p.id).eq("status", "accepted"),
  ]);
  const sections = new Set((sectionsRes.data as string[] | null) ?? (isMe ? ["streaks", "training", "tests", "meals", "body"] : []));
  if (isMe) ["streaks", "training", "tests", "meals", "body"].forEach((s) => sections.add(s));

  const [streaks, achievements, program, workouts, tests, weights, meals] = await Promise.all([
    sections.has("streaks") ? supabase.from("user_streaks").select("*").eq("user_id", p.id) : null,
    sections.has("streaks") ? supabase.from("user_achievements").select("code, unlocked_at, achievements(name, emoji)").eq("user_id", p.id).order("unlocked_at", { ascending: false }).limit(12) : null,
    sections.has("training")
      ? supabase.from("programs").select("id, name, program_sessions(week, weekday, name, program_exercises(exercise_id, position, sets, reps_min, reps_max))").eq("user_id", p.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle()
      : null,
    sections.has("training") ? supabase.from("workout_sessions").select("log_date, duration_min, volume_kg").eq("user_id", p.id).not("ended_at", "is", null).order("log_date", { ascending: false }).limit(5) : null,
    sections.has("tests") ? supabase.from("fitness_tests").select("test, value, unit, log_date").eq("user_id", p.id).order("log_date", { ascending: false }).limit(30) : null,
    sections.has("body") ? supabase.from("weight_logs").select("log_date, kg").eq("user_id", p.id).gte("log_date", addDays(me.today, -90)).order("log_date") : null,
    sections.has("meals") ? supabase.from("food_logs").select("log_date, meal, food_log_items(name)").eq("user_id", p.id).gte("log_date", addDays(me.today, -2)).order("created_at", { ascending: false }).limit(8) : null,
  ]);

  const week1 = (program?.data?.program_sessions ?? []).filter((s) => s.week === 1).sort((a, b) => a.weekday - b.weekday);
  const latestTests = new Map<string, { value: number; unit: string; log_date: string }>();
  for (const t of tests?.data ?? []) if (!latestTests.has(t.test)) latestTests.set(t.test, { value: Number(t.value), unit: t.unit, log_date: t.log_date });
  const canSeeContent = isMe || !p.is_private || myFollow.data?.status === "accepted";

  if (myBlock.data && !isMe) {
    return (
      <main className="space-y-4 px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <BackHeader title={`@${p.username}`} href="/perfil/buscar" />
        <p className="text-muted">Bloqueaste a este perfil.</p>
        <FollowControls targetId={p.id} username={p.username} state="none" followsMe={false} blocked canCopy={false} />
      </main>
    );
  }

  return (
    <main className="space-y-4 px-4 pt-[max(12px,env(safe-area-inset-top))]">
      <BackHeader title={`@${p.username}`} href={isMe ? "/perfil" : "/perfil/buscar"} subtitle={isMe ? "Así te ven los demás" : undefined} />
      <header className="flex items-center gap-4 px-1">
        <Avatar src={p.avatar_url} name={p.display_name || p.username} size={76} />
        <div className="min-w-0 flex-1">
          <p className="score truncate text-[24px] leading-none">{p.display_name || p.username}</p>
          <div className="mt-1.5 flex gap-4 text-sm">
            <span>
              <span className="font-bold">{followers.count ?? 0}</span> <span className="text-muted">seguidores</span>
            </span>
            <span>
              <span className="font-bold">{following.count ?? 0}</span> <span className="text-muted">seguidos</span>
            </span>
          </div>
        </div>
      </header>
      {p.bio ? <p className="px-1">{p.bio}</p> : null}
      <div className="flex flex-wrap gap-1.5 px-1">
        {(sports.data ?? []).map((s) => (
          <span key={s.id} className="rounded-[9px] bg-surface-2 px-2.5 py-1 text-sm">
            {SPORT_INFO[s.sport as Sport]?.emoji} {SPORT_INFO[s.sport as Sport]?.label}
            {s.position ? ` · ${s.position}` : ""}
          </span>
        ))}
      </div>
      {!isMe ? (
        <FollowControls
          targetId={p.id}
          username={p.username}
          state={(myFollow.data?.status as "pending" | "accepted" | undefined) ?? "none"}
          followsMe={Boolean(theirFollow.data)}
          blocked={false}
          canCopy={Boolean(program?.data)}
        />
      ) : null}

      {!canSeeContent ? (
        <div className="rounded-[20px] border border-dashed border-line p-6 text-center">
          <Lock className="mx-auto size-6 text-muted" />
          <p className="mt-2 font-semibold">Cuenta privada</p>
          <p className="text-sm text-muted">Mandá solicitud para ver sus entrenos y rachas.</p>
        </div>
      ) : sections.size === 0 ? (
        <p className="px-1 text-sm text-muted">Este perfil no muestra nada por ahora.</p>
      ) : null}

      {streaks?.data?.length ? (
        <Section title={SECTION_LABELS.streaks}>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              ["logging", "📒", "Registro"],
              ["water", "💧", "Agua"],
              ["protein", "🥚", "Proteína"],
              ["training_week", "🏋️", "Entreno"],
            ].map(([k, e, l]) => {
              const s = streaks.data.find((x) => x.kind === k);
              return (
                <div key={k} className="rounded-[14px] bg-surface-2 py-2.5">
                  <p>{e}</p>
                  <p className="score text-2xl">{s?.current ?? 0}</p>
                  <p className="text-[11px] text-muted">{l}</p>
                </div>
              );
            })}
          </div>
          {achievements?.data?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {achievements.data.map((a) => {
                const ach = a.achievements as { name: string; emoji: string } | null;
                return (
                  <span key={a.code} className="rounded-[9px] bg-surface-2 px-2.5 py-1 text-sm">
                    {ach?.emoji} {ach?.name}
                  </span>
                );
              })}
            </div>
          ) : null}
        </Section>
      ) : null}

      {program?.data ? (
        <Section title={`${SECTION_LABELS.training}: ${program.data.name}`}>
          <div className="space-y-3">
            {week1.map((s) => (
              <div key={`${s.week}-${s.weekday}`}>
                <p className="text-sm text-muted first-letter:uppercase">
                  {WEEKDAY_LABELS[s.weekday].long} · <span className="font-semibold text-text">{s.name}</span>
                </p>
                <p className="text-sm">
                  {[...(s.program_exercises ?? [])]
                    .sort((a, b) => a.position - b.position)
                    .map((e) => `${LIBRARY_BY_ID[e.exercise_id]?.name ?? e.exercise_id} ${e.sets}×${e.reps_min}${e.reps_max !== e.reps_min ? `–${e.reps_max}` : ""}`)
                    .join(" · ")}
                </p>
              </div>
            ))}
          </div>
          {workouts?.data?.length ? <p className="mt-3 text-sm text-muted">Últimas sesiones: {workouts.data.map((w) => formatDayShort(w.log_date)).join(", ")}</p> : null}
        </Section>
      ) : null}

      {latestTests.size ? (
        <Section title={SECTION_LABELS.tests}>
          <div className="grid grid-cols-2 gap-2">
            {[...latestTests.entries()].map(([k, t]) => (
              <div key={k} className="rounded-[14px] bg-surface-2 p-3">
                <p className="text-xs text-muted">{TEST_INFO[k as keyof typeof TEST_INFO]?.label ?? k}</p>
                <p className="score text-2xl">
                  {fmt1(t.value)} <span className="font-sans text-sm font-normal text-muted">{t.unit}</span>
                </p>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {weights?.data?.length ? (
        <Section title={SECTION_LABELS.body}>
          <WeightChart weights={weights.data.map((w) => ({ date: w.log_date, kg: Number(w.kg) }))} today={me.today} />
        </Section>
      ) : null}

      {meals?.data?.length ? (
        <Section title={SECTION_LABELS.meals}>
          <ul className="space-y-1.5 text-sm">
            {meals.data.map((m, i) => (
              <li key={i}>
                <span className="text-muted">
                  {formatDayShort(m.log_date)} · {MEALS.find((x) => x.value === m.meal)?.label}:
                </span>{" "}
                {(m.food_log_items ?? []).map((x) => x.name).join(", ")}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </main>
  );
}
