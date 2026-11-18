import { requireMe } from "@/lib/data/me";
import { createClient } from "@/lib/supabase/server";
import { BackHeader } from "@/components/profile/back-header";
import { ACHIEVEMENTS } from "@/lib/gamification/achievements-data";
import { formatDayShort } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata = { title: "Logros" };

export default async function LogrosPage() {
  const me = await requireMe();
  const supabase = await createClient();
  const { data } = await supabase.from("user_achievements").select("code, unlocked_at").eq("user_id", me.userId);
  const got = new Map((data ?? []).map((a) => [a.code, a.unlocked_at]));
  return (
    <main className="px-4 pt-[max(12px,env(safe-area-inset-top))]">
      <BackHeader title="Logros" subtitle={`${got.size} de ${ACHIEVEMENTS.length}`} />
      <ul className="grid grid-cols-2 gap-2.5">
        {ACHIEVEMENTS.map((a) => {
          const at = got.get(a.code);
          return (
            <li key={a.code} className={cn("rounded-[18px] border p-3.5", at ? "border-accent/50 bg-accent/6" : "border-line bg-surface opacity-60")}>
              <p className={cn("text-3xl", !at && "grayscale")}>{a.emoji}</p>
              <p className="mt-1.5 font-semibold leading-snug">{a.name}</p>
              <p className="text-xs text-muted">{a.description}</p>
              {at ? <p className="mt-1 text-xs text-accent">{formatDayShort(at.slice(0, 10))}</p> : null}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
