"use client";
import { createContext, useContext } from "react";
import type { Sport } from "@/lib/calc/types";

export interface PlannedToday {
  scheduleId: string;
  sport: Sport;
  kind: "training" | "match";
  start_time: string | null;
  duration_min: number;
  intensity: "light" | "moderate" | "hard";
}

export interface AppCtx {
  today: string;
  tz: string;
  glassMl: number;
  bottleMl: number;
  lastWeightKg: number | null;
  sports: Sport[];
  schedule: (PlannedToday & { weekday: number })[];
}

const Ctx = createContext<AppCtx | null>(null);

export function AppContextProvider({ value, children }: { value: AppCtx; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppCtx(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("AppContextProvider faltante");
  return v;
}

/** Fecha activa: la del diario si se está viendo otro día; si no, hoy. */
export function useActiveDate(): string {
  const { today } = useAppCtx();
  if (typeof window === "undefined") return today;
  const d = new URLSearchParams(window.location.search).get("date");
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today ? d : today;
}

export function defaultMealForHour(hour: number): "breakfast" | "lunch" | "snack" | "dinner" | "extra" {
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 19) return "snack";
  if (hour < 23) return "dinner";
  return "extra";
}
