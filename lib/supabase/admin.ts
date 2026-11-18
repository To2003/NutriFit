import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";
import type { Database } from "./database.types";
import { createDemoClient, isDemo } from "@/lib/demo/store";

/** Cliente con service role: SOLO para /api/cron/*. Saltea RLS. */
export function createAdminClient() {
  if (isDemo()) return createDemoClient() as unknown as ReturnType<typeof createClient<Database>>;
  const key = serverEnv().serviceRoleKey;
  if (!key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
