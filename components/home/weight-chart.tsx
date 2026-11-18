"use client";
import { useMemo, useState } from "react";
import { Area, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { Segmented } from "@/components/ui/choice";
import { emaTrend } from "@/lib/calc/tdee";
import { addDays, daysBetween, formatDayShort } from "@/lib/dates";
import { fmt1 } from "@/lib/utils";

type Range = "7" | "30" | "90";

export function WeightChart({ weights, today }: { weights: { date: string; kg: number }[]; today: string }) {
  const [range, setRange] = useState<Range>("30");
  const data = useMemo(() => {
    const trend = emaTrend(weights);
    const from = addDays(today, -Number(range) + 1);
    const pts = trend.filter((p) => p.date >= from).map((p) => ({ date: p.date, kg: p.kg, trend: Math.round(p.trendKg * 100) / 100 }));
    // proyección: tendencia de los últimos 14 días, 4 semanas hacia adelante
    const last14 = trend.filter((p) => p.date >= addDays(today, -14));
    let projection: { date: string; proj: number }[] = [];
    let weekly = 0;
    if (last14.length >= 4) {
      const a = last14[0];
      const b = last14[last14.length - 1];
      const span = Math.max(1, daysBetween(a.date, b.date));
      const perDay = (b.trendKg - a.trendKg) / span;
      weekly = perDay * 7;
      projection = [0, 7, 14, 21, 28].map((d) => ({ date: addDays(b.date, d), proj: Math.round((b.trendKg + perDay * d) * 100) / 100 }));
    }
    return { pts, projection, weekly };
  }, [weights, range, today]);

  const merged = useMemo(() => {
    const byDate = new Map<string, { date: string; kg?: number; trend?: number; proj?: number }>();
    for (const p of data.pts) byDate.set(p.date, { ...p });
    for (const p of data.projection) byDate.set(p.date, { ...(byDate.get(p.date) ?? { date: p.date }), proj: p.proj });
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  if (weights.length === 0) return <p className="text-sm text-muted">Pesate una vez y arrancamos la línea de tendencia.</p>;
  const last = data.pts[data.pts.length - 1];

  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="score text-[30px] whitespace-nowrap">
            {last ? fmt1(last.trend) : "—"}
            <span className="font-sans text-sm font-normal text-muted"> kg</span>
          </p>
          <p className="text-xs text-muted">de tendencia</p>
        </div>
        <div className="w-[132px] shrink-0">
          <Segmented
            label="Rango"
            value={range}
            onChange={setRange}
            options={[
              { value: "7", label: "7d" },
              { value: "30", label: "30d" },
              { value: "90", label: "90d" },
            ]}
          />
        </div>
      </div>
      {data.projection.length ? (
        <p className="mb-2 text-sm text-muted">
          {Math.abs(data.weekly) < 0.05
            ? "Estable las últimas 2 semanas."
            : `${data.weekly < 0 ? "Bajando" : "Subiendo"} ${fmt1(Math.abs(data.weekly))} kg por semana. Si seguís así, en 4 semanas: ~${fmt1(data.projection[4].proj)} kg.`}
        </p>
      ) : null}
      <div className="h-44" role="img" aria-label="Gráfico de peso con tendencia">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={merged} margin={{ top: 6, right: 6, left: -6, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tickFormatter={formatDayShort} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis domain={["dataMin - 0.5", "dataMax + 0.5"]} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => fmt1(v)} />
            <Tooltip
              contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--text)" }}
              labelFormatter={(l) => formatDayShort(String(l))}
              formatter={(v, n) => [`${fmt1(Number(v))} kg`, n === "kg" ? "Pesaje" : n === "trend" ? "Tendencia" : "Proyección"]}
            />
            <Area type="monotone" dataKey="trend" stroke="var(--accent)" strokeWidth={2.5} fill="url(#trendFill)" connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="proj" stroke="var(--accent)" strokeDasharray="4 5" strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
            <Scatter dataKey="kg" fill="var(--text)" shape="circle" r={2.5} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
