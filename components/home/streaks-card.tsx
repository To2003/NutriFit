import { createClient } from "@/lib/supabase/server";
import { loadMe } from "@/lib/data/me";
import { refreshStreaks } from "@/lib/gamification/streaks-service";
import { Section } from "./section";

export async function StreaksCard({ userId }: { userId: string }) {
  const supabase = await createClient();
  const me = await loadMe(supabase, userId);
  if (!me) return null;
  const s = await refreshStreaks(supabase, me);
  const items = [
    { label: "Registro", emoji: "📒", v: s.logging, unit: "días" },
    { label: "Agua", emoji: "💧", v: s.water, unit: "días" },
    { label: "Proteína", emoji: "🥚", v: s.protein, unit: "días" },
    { label: "Entreno", emoji: "🏋️", v: s.training_week, unit: "sem." },
  ];
  return (
    <Section title="Rachas" href="/perfil/logros" linkLabel="Logros">
      <div className="grid grid-cols-4 gap-2 text-center">
        {items.map((it) => (
          <div key={it.label} className="rounded-[14px] bg-surface-2 px-1 py-2.5">
            <p className="text-lg leading-none">{it.emoji}</p>
            <p className={`score mt-1 text-2xl ${it.v.current > 0 ? "text-accent" : "text-muted"}`}>{it.v.current}</p>
            <p className="text-[11px] text-muted">{it.label}</p>
            <p className="text-[10px] text-muted">mejor {it.v.best}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
