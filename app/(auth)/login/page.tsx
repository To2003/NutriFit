import { isSupabaseConfigured } from "@/lib/env";
import { GoogleButton } from "@/components/auth/google-button";
import { ProfeMark } from "@/components/ui/profe";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : undefined;
  const failed = sp.error === "auth";
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-lg flex-col overflow-hidden px-6 pt-[max(24px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))]">
      {/* Marcas de cancha */}
      <svg aria-hidden className="pointer-events-none absolute inset-x-0 top-24 mx-auto h-[420px] w-[520px] text-line" viewBox="0 0 520 420" fill="none">
        <rect x="20" y="10" width="480" height="400" rx="6" stroke="currentColor" strokeWidth="2" />
        <line x1="20" y1="210" x2="500" y2="210" stroke="currentColor" strokeWidth="2" />
        <line x1="20" y1="140" x2="500" y2="140" stroke="currentColor" strokeWidth="1" strokeDasharray="6 8" />
        <line x1="20" y1="280" x2="500" y2="280" stroke="currentColor" strokeWidth="1" strokeDasharray="6 8" />
      </svg>

      <div className="relative flex items-center gap-2.5">
        <ProfeMark size={34} />
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
