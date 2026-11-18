import Link from "next/link";
import { Lock, Search } from "lucide-react";
import { requireMe } from "@/lib/data/me";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/profile/avatar";
import { MenuLink } from "@/components/profile/menu-link";
import { EditProfile } from "@/components/profile/edit-profile";
import { SignOutButton } from "@/components/auth/signout-button";
import { SPORT_INFO } from "@/lib/domain/catalog";
import type { Sport } from "@/lib/calc/types";
import { serverEnv } from "@/lib/env";

export const metadata = { title: "Perfil" };

export default async function PerfilPage() {
  const me = await requireMe();
  const supabase = await createClient();
  const monthStart = `${me.today.slice(0, 7)}-01`;
  const [followers, following, requests, usage, limits] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", me.userId).eq("status", "accepted"),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", me.userId).eq("status", "accepted"),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", me.userId).eq("status", "pending"),
    supabase.from("ai_usage").select("day, calls").eq("user_id", me.userId).gte("day", monthStart),
    supabase.from("ai_limits").select("daily_cap, monthly_cap").eq("user_id", me.userId).maybeSingle(),
  ]);
  const env = serverEnv();
  const aiToday = (usage.data ?? []).find((u) => u.day === me.today)?.calls ?? 0;
  const aiMonth = (usage.data ?? []).reduce((acc, u) => acc + u.calls, 0);
  const capDay = limits.data?.daily_cap ?? env.aiDailyCapPerUser;
  const capMonth = limits.data?.monthly_cap ?? env.aiMonthlyCapPerUser;
  const p = me.profile;
  return (
    <main className="space-y-4 px-4 pt-[max(18px,env(safe-area-inset-top))]">
      <header className="flex items-center gap-4 px-1">
        <Avatar src={p.avatar_url} name={p.display_name || p.username} size={76} />
        <div className="min-w-0 flex-1">
          <h1 className="score truncate text-[26px] leading-none">{p.display_name || p.username}</h1>
          <p className="text-muted">
            @{p.username} {p.is_private ? <Lock className="inline size-3.5" aria-label="Cuenta privada" /> : null}
          </p>
          <div className="mt-1.5 flex gap-4 text-sm">
            <Link href="/perfil/seguidores?tab=seguidores">
              <span className="font-bold">{followers.count ?? 0}</span> <span className="text-muted">seguidores</span>
            </Link>
            <Link href="/perfil/seguidores?tab=siguiendo">
              <span className="font-bold">{following.count ?? 0}</span> <span className="text-muted">seguidos</span>
            </Link>
          </div>
        </div>
        <Link href="/perfil/buscar" aria-label="Buscar personas" className="grid size-11 place-items-center rounded-full border border-line">
          <Search className="size-5" />
        </Link>
      </header>
      {p.bio ? <p className="px-1">{p.bio}</p> : null}
      {me.sports.length ? (
        <div className="flex flex-wrap gap-1.5 px-1">
          {me.sports.map((s) => (
            <span key={s.id} className="rounded-[9px] bg-surface-2 px-2.5 py-1 text-sm">
              {SPORT_INFO[s.sport as Sport]?.emoji} {SPORT_INFO[s.sport as Sport]?.label}
              {s.position ? ` · ${s.position}` : ""}
            </span>
          ))}
        </div>
      ) : null}
      <EditProfile name={p.display_name} bio={p.bio} avatar={p.avatar_url} glass={me.details.water_glass_ml} bottle={me.details.water_bottle_ml} />

      <nav aria-label="Ajustes" className="divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface">
        {requests.count ? <MenuLink href="/perfil/solicitudes" label="Solicitudes de seguimiento" badge={requests.count} /> : null}
        <MenuLink href="/perfil/ajustes/objetivos" label="Tus objetivos" hint="Kcal, macros y agua por tipo de día" />
        <MenuLink href="/perfil/progreso" label="Medidas y tests físicos" hint="Cintura, salto, sprint…" />
        <MenuLink href="/perfil/logros" label="Logros" />
        <MenuLink href={`/perfil/${p.username}`} label="Ver mi perfil público" hint="Así te ven los demás" />
      </nav>

      <section aria-label="Uso del Profe" className="rounded-[20px] border border-line bg-surface p-4">
        <p className="font-semibold">Consultas al Profe (IA)</p>
        <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
          {[
            { label: "Hoy", used: aiToday, cap: capDay },
            { label: "Este mes", used: aiMonth, cap: capMonth },
          ].map((x) => (
            <div key={x.label}>
              <p className="text-muted">{x.label}</p>
              <p className="tnum font-semibold">
                {Math.min(x.used, x.cap)} <span className="font-normal text-muted">de {x.cap}</span>
              </p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="bg-grad h-full rounded-full" style={{ width: `${Math.min(100, x.cap ? (x.used / x.cap) * 100 : 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Cuando se terminan, el Profe sigue con las respuestas de base.</p>
      </section>

      <nav aria-label="Configuración" className="divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface">
        <MenuLink href="/perfil/ajustes/datos" label="Datos personales" hint="Usuario, altura, peso" />
        <MenuLink href="/perfil/ajustes/objetivo" label="Objetivo y ritmo" />
        <MenuLink href="/perfil/ajustes/estilo" label="Estilo de vida" />
        <MenuLink href="/perfil/ajustes/agenda" label="Agenda semanal" hint="Entrenos y partidos fijos" />
        <MenuLink href="/perfil/ajustes/deportes" label="Deportes" />
        <MenuLink href="/perfil/ajustes/gimnasio" label="Gimnasio" hint="Días, minutos, equipamiento, molestias" />
        <MenuLink href="/perfil/ajustes/foco" label="Foco de la rutina" />
        <MenuLink href="/perfil/ajustes/alimentacion" label="Alimentación" />
        <MenuLink href="/perfil/ajustes/notificaciones" label="Notificaciones" />
        <MenuLink href="/perfil/ajustes/privacidad" label="Privacidad" />
      </nav>

      <SignOutButton />
      <p className="pb-4 text-center text-xs text-muted">NutriFit no reemplaza a un médico, nutricionista ni deportólogo.</p>
    </main>
  );
}
