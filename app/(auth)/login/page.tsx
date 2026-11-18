import { isSupabaseConfigured } from "@/lib/env";
import { GoogleButton } from "@/components/auth/google-button";
import { HeroOrb } from "@/components/auth/hero-orb";
import { AppMark } from "@/components/ui/profe";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : undefined;
  const failed = sp.error === "auth";
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-6 pt-[max(20px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-2.5">
        <AppMark size={34} />
        <span className="score text-xl">NutriFit</span>
      </div>

      <div className="flex flex-1 flex-col justify-center py-6">
        <HeroOrb />
        <h1 className="score mt-6 text-[44px] leading-[1.02]">
          Comé, entrená, <span className="text-grad">rendí.</span>
        </h1>
        <p className="mt-3 text-[17px] text-muted">Tu profe de nutrición y gym, en el bolsillo.</p>
      </div>

      <div className="space-y-3">
        {failed ? (
          <p role="alert" className="rounded-[14px] border border-alert/40 bg-alert/10 p-3 text-sm">
            No pudimos completar el ingreso. Probá de nuevo.
          </p>
        ) : null}
        {isSupabaseConfigured() ? (
          <GoogleButton next={next} />
        ) : (
          <p className="rounded-[14px] border border-line bg-surface p-3 text-sm text-muted">Falta configurar Supabase (ver README) o correr `pnpm demo`.</p>
        )}
        <p className="text-center text-xs text-muted">+18 · No reemplaza a un profesional de la salud.</p>
      </div>
    </main>
  );
}
