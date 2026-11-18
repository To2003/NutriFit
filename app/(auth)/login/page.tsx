import { isSupabaseConfigured } from "@/lib/env";
import { GoogleButton } from "@/components/auth/google-button";
import { AppMark } from "@/components/ui/profe";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : undefined;
  const failed = sp.error === "auth";
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-lg flex-col overflow-hidden px-6 pt-[max(24px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
      {/* Marcas de cancha */}
      {/* Cancha de vóley vista desde arriba: red al medio, líneas de ataque punteadas */}
      <svg aria-hidden className="pointer-events-none absolute top-24 left-6 h-[46dvh] w-[calc(100%-3rem)] text-line" viewBox="0 0 300 420" preserveAspectRatio="none" fill="none">
        <rect x="1" y="1" width="298" height="418" rx="4" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1="210" x2="300" y2="210" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1="140" x2="300" y2="140" stroke="currentColor" strokeWidth="1" strokeDasharray="5 7" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1="280" x2="300" y2="280" stroke="currentColor" strokeWidth="1" strokeDasharray="5 7" vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="relative flex items-center gap-2.5">
        <AppMark size={34} />
        <span className="score text-2xl">NutriFit</span>
      </div>

      <div className="relative mt-auto mb-10">
        <p className="score text-[84px] leading-[0.82] text-text">
          Comé,
          <br />
          entrená,
          <br />
          <span className="text-accent">rendí.</span>
        </p>
        <p className="mt-5 max-w-xs text-[17px] text-muted">
          Tu diario de comida y entreno, con un profe que te arma la rutina según tu deporte y nunca te reta.
        </p>
      </div>

      <div className="relative space-y-3">
        {failed ? (
          <p role="alert" className="rounded-[12px] border border-alert/40 bg-alert/10 p-3 text-sm">
            No pudimos completar el ingreso. Probá de nuevo.
          </p>
        ) : null}
        {isSupabaseConfigured() ? (
          <GoogleButton next={next} />
        ) : (
          <p className="rounded-[12px] border border-line bg-surface p-3 text-sm text-muted">
            Falta configurar Supabase (NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY).
          </p>
        )}
        <p className="text-center text-xs text-muted">
          Solo para mayores de 18. NutriFit no reemplaza a un médico, nutricionista ni deportólogo.
        </p>
      </div>
    </main>
  );
}
