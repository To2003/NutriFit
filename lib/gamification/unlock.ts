import "server-only";
import type { ServerClient } from "@/lib/supabase/server";

/** Desbloquea logros (idempotente). Devuelve los nuevos. */
export async function unlockAchievements(supabase: ServerClient, userId: string, codes: string[]): Promise<string[]> {
  if (!codes.length) return [];
  const have = await supabase.from("user_achievements").select("code").eq("user_id", userId).in("code", codes);
  const owned = new Set((have.data ?? []).map((r) => r.code));
  const fresh = codes.filter((c) => !owned.has(c));
  if (fresh.length) await supabase.from("user_achievements").upsert(fresh.map((code) => ({ user_id: userId, code })), { onConflict: "user_id,code", ignoreDuplicates: true });
  return fresh;
}
