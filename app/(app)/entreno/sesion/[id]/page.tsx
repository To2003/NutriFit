import { notFound } from "next/navigation";
import { requireMe } from "@/lib/data/me";
import { createClient } from "@/lib/supabase/server";
import { lastSetsByExercise } from "@/lib/data/training";
import { EXERCISE_TEXT, LIBRARY_BY_ID } from "@/lib/training/library-data";
import { nextLoad } from "@/lib/training/progression";
import { GymMode, type GymExercise } from "@/components/training/gym-mode";
import { fmt1 } from "@/lib/utils";

export const metadata = { title: "En el gym" };

export default async function SesionPage({ params }: PageProps<"/entreno/sesion/[id]">) {
  const { id } = await params;
  const me = await requireMe();
  const supabase = await createClient();
  const s = await supabase.from("program_sessions").select("*, program_exercises(*)").eq("id", id).eq("user_id", me.userId).maybeSingle();
  if (!s.data) notFound();
  const pes = [...(s.data.program_exercises ?? [])].sort((a, b) => a.position - b.position);
  const last = await lastSetsByExercise(supabase, me.userId, pes.map((e) => e.exercise_id));

  const exercises: GymExercise[] = pes.map((e) => {
    const info = LIBRARY_BY_ID[e.exercise_id];
    const prev = last[e.exercise_id] ?? [];
    const sug = info ? nextLoad({ last: prev, repsMax: e.reps_max, region: info.region, loadType: info.load_type }) : { kg: null, reason: "first_time" as const };
    const reason =
      sug.reason === "up"
        ? `Completaste el rango la vez pasada: subí a ${fmt1(sug.kg)} kg 💪`
        : sug.reason === "first_time" && info && info.load_type !== "bodyweight"
          ? "Primera vez: elegí un peso que te deje 2–3 reps en reserva."
          : "";
    return {
      exerciseId: e.exercise_id,
      name: info?.name ?? e.exercise_id,
      sets: e.sets,
      repsMin: e.reps_min,
      repsMax: e.reps_max,
      restS: e.rest_s,
      rir: e.rir,
      notes: e.notes,
      instructions: EXERCISE_TEXT[e.exercise_id]?.instructions ?? "",
      mistakes: EXERCISE_TEXT[e.exercise_id]?.mistakes ?? "",
      loadType: info?.load_type ?? "other",
      suggestedKg: sug.kg,
      suggestionReason: reason,
      previous: prev,
    };
  });

  return <GymMode programSessionId={s.data.id} title={s.data.name} exercises={exercises} />;
}
