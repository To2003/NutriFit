import { requireMe } from "@/lib/data/me";
import { createClient } from "@/lib/supabase/server";
import { BackHeader } from "@/components/profile/back-header";
import { Section } from "@/components/home/section";
import { MeasurementsForm, TestForm } from "@/components/profile/progress-forms";
import { TEST_INFO, type TestKind } from "@/lib/domain/tests";
import { daysBetween, formatDayShort } from "@/lib/dates";
import { fmt1 } from "@/lib/utils";

export const metadata = { title: "Progreso" };

export default async function ProgresoPage() {
  const me = await requireMe();
  const supabase = await createClient();
  const [meas, tests] = await Promise.all([
    supabase.from("body_measurements").select("*").eq("user_id", me.userId).order("log_date", { ascending: false }).limit(10),
    supabase.from("fitness_tests").select("*").eq("user_id", me.userId).order("log_date", { ascending: false }).limit(100),
  ]);
  const lastMeas = meas.data?.[0];
  const firstMeas = meas.data?.[meas.data.length - 1];
  const measDue = !lastMeas || daysBetween(lastMeas.log_date, me.today) >= 14;
  const cols = [
    ["waist_cm", "Cintura"],
    ["hip_cm", "Cadera"],
    ["chest_cm", "Pecho"],
    ["arm_cm", "Brazo"],
    ["thigh_cm", "Muslo"],
    ["neck_cm", "Cuello"],
  ] as const;

  return (
    <main className="space-y-4 px-4 pt-[max(12px,env(safe-area-inset-top))]">
      <BackHeader title="Progreso" subtitle="Medidas cada 2 semanas, tests cada 4." />

      <Section title="Medidas">
        {measDue ? <p className="mb-3 text-sm text-accent">Toca medirte 📏</p> : <p className="mb-3 text-sm text-muted">Última: {formatDayShort(lastMeas!.log_date)}. La próxima en {14 - daysBetween(lastMeas!.log_date, me.today)} días.</p>}
        {lastMeas ? (
          <dl className="mb-3 grid grid-cols-3 gap-2">
            {cols.map(([k, l]) => {
              const v = lastMeas[k];
              const f = firstMeas?.[k];
              if (v == null) return null;
              const d = f != null && firstMeas !== lastMeas ? Number(v) - Number(f) : null;
              return (
                <div key={k} className="rounded-[12px] bg-surface-2 p-2.5">
                  <dt className="text-xs text-muted">{l}</dt>
                  <dd className="score text-xl">{fmt1(Number(v))}</dd>
                  {d != null && d !== 0 ? <dd className="text-xs text-muted">{d > 0 ? "+" : ""}{fmt1(d)} cm</dd> : null}
                </div>
              );
            })}
          </dl>
        ) : null}
        <MeasurementsForm />
      </Section>

      <Section title="Tests físicos">
        <ul className="divide-y divide-line">
          {(Object.keys(TEST_INFO) as TestKind[]).map((t) => {
            const hist = (tests.data ?? []).filter((x) => x.test === t);
            const last = hist[0];
            const first = hist[hist.length - 1];
            const due = !last || daysBetween(last.log_date, me.today) >= 28;
            const delta = last && first && hist.length > 1 ? Number(last.value) - Number(first.value) : null;
            const better = delta != null && (TEST_INFO[t].higherIsBetter ? delta > 0 : delta < 0);
            return (
              <li key={t} className="flex items-center gap-3 py-3">
                <div className="flex-1">
                  <p className="font-medium">{TEST_INFO[t].label}</p>
                  <p className="text-sm text-muted">
                    {last ? (
                      <>
                        <span className="score text-xl text-text">{fmt1(Number(last.value))}</span> {TEST_INFO[t].unit} · {formatDayShort(last.log_date)}
                        {delta ? <span className={better ? "text-accent" : ""}> · {delta > 0 ? "+" : ""}{fmt1(delta)} desde el primero</span> : null}
                      </>
                    ) : (
                      "Sin datos todavía"
                    )}
                    {due ? <span className="text-accent"> · toca test</span> : null}
                  </p>
                </div>
                <TestForm test={t} />
              </li>
            );
          })}
        </ul>
      </Section>
    </main>
  );
}
