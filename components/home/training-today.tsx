import Link from "next/link";
import { Play } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Me } from "@/lib/data/me";
import { getActiveProgram, nextSession } from "@/lib/data/training";
import { LIBRARY_BY_ID } from "@/lib/training/library-data";
import { WEEKDAY_LABELS } from "@/lib/domain/catalog";
import { Button } from "@/components/ui/button";
import { Section } from "./section";

export async function TrainingToday({ me }: { me: Me }) {
  if (!me.gym?.weekdays?.length) return null;
  const supabase = await createClient();
  const ap = await getActiveProgram(supabase, me);
  if (!ap) {
    return (
      <Section title="Entreno">
        <p className="mb-3 text-sm text-muted">Todavía no tenés rutina. Te la armo en un toque.</p>
        <Button asChild block>
          <Link href="/entreno">Armar mi rutina</Link>
        </Button>
      </Section>
    );
  }
  const n = nextSession(ap, me.today);
  if (!n) {
    return (
      <Section title="Entreno" href="/entreno">
        <p className="text-sm text-muted">{ap.finished ? "Terminaste el mesociclo 🎯 Armemos el próximo." : "No te queda sesión esta semana. ¡Descansá!"}</p>
      </Section>
    );
  }
  const done = await supabase.from("workout_sessions").select("id").eq("program_session_id", n.session.id).not("ended_at", "is", null).limit(1).maybeSingle();
  const names = n.session.program_exercises.slice(0, 4).map((e) => LIBRARY_BY_ID[e.exercise_id]?.name ?? e.exercise_id);
  return (
    <Section title={n.isToday ? "Entreno de hoy" : `Próxima sesión · ${WEEKDAY_LABELS[n.session.weekday].long}`} href="/entreno" linkLabel="Rutina">
      <p className="score text-3xl">{n.session.name}</p>
      <p className="mt-1 text-sm text-muted">
        {names.join(" · ")}
        {n.session.program_exercises.length > 4 ? ` y ${n.session.program_exercises.length - 4} más` : ""}
      </p>
      {n.isToday && !done.data ? (
        <Button asChild block size="lg" className="mt-3">
          <Link href={`/entreno/sesion/${n.session.id}`}>
            <Play className="size-5" /> Empezar
          </Link>
        </Button>
      ) : done.data ? (
        <p className="mt-2 text-sm font-semibold text-accent">Hecha ✓</p>
      ) : null}
    </Section>
  );
}
