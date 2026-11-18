/** Variables públicas (disponibles en el cliente). */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
};

export function isSupabaseConfigured(): boolean {
  return process.env.NEXT_PUBLIC_DEMO === "1" || Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

/** Variables sólo de servidor. Nunca importar desde un componente cliente. */
export function serverEnv() {
  return {
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    geminiModel: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    /**
     * Modelos de respaldo, en orden (separados por coma). En el plan gratis cada modelo tiene su propio
     * cupo diario, así que encadenarlos multiplica las consultas disponibles.
     */
    geminiFallbackModels: (process.env.GEMINI_FALLBACK_MODELS ?? process.env.GEMINI_FALLBACK_MODEL ?? "gemma-4-31b-it,gemini-3-flash,gemini-2.5-flash-lite")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean),
    /**
     * IA también en feedback por carga, cierre del día y sesiones. Por defecto sí si hay un modelo Gemma
     * en la cadena (cupo grande); "0" lo apaga, "1" lo fuerza.
     */
    geminiRich:
      process.env.GEMINI_RICH === "1" ||
      (process.env.GEMINI_RICH !== "0" &&
        /gemma/i.test(process.env.GEMINI_FALLBACK_MODELS ?? process.env.GEMINI_FALLBACK_MODEL ?? "gemma-4-31b-it")),
    usdaApiKey: process.env.USDA_API_KEY ?? "",
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
    vapidSubject: process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    cronSecret: process.env.CRON_SECRET ?? "",
  };
}
