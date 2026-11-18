/** Uso devuelto por consume_ai_quota (ya incluye la llamada actual). */
export interface QuotaUsage {
  user_day: number;
  user_month: number;
  global_day: number;
  daily_cap: number | null;
  monthly_cap: number | null;
}

export interface QuotaLimits {
  dailyPerUser: number;
  monthlyPerUser: number;
  dailyGlobal: number;
}

export type QuotaBlock = "user_day" | "user_month" | "global_day";

/** ¿Se puede hacer esta llamada? Las excepciones por usuario (ai_limits) pisan los topes por defecto. */
export function quotaBlock(q: QuotaUsage | null | undefined, l: QuotaLimits): QuotaBlock | null {
  if (!q) return null; // sin datos (p. ej. demo): no bloqueamos
  if (q.global_day > l.dailyGlobal) return "global_day";
  if (q.user_day > (q.daily_cap ?? l.dailyPerUser)) return "user_day";
  if (q.user_month > (q.monthly_cap ?? l.monthlyPerUser)) return "user_month";
  return null;
}

export const QUOTA_COPY: Record<QuotaBlock, string> = {
  user_day: "Llegaste al tope de consultas al Profe por hoy: mañana se renueva. Mientras, va con la base local.",
  user_month: "Llegaste al tope de consultas al Profe de este mes. Mientras, va con la base local.",
  global_day: "El Profe está a full por hoy. Mientras, va con la base local.",
};
