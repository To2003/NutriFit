"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/data/me";

const subSchema = z.object({
  endpoint: z.string().url().max(1000),
  p256dh: z.string().min(1).max(200),
  auth: z.string().min(1).max(100),
  userAgent: z.string().max(200).optional(),
});

export async function savePushSubscription(input: z.infer<typeof subSchema>): Promise<{ ok: boolean }> {
  const userId = await getUserId();
  if (!userId) return { ok: false };
  const parsed = subSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const supabase = await createClient();
  // El endpoint es único: si existía de otra sesión del mismo usuario, se actualiza.
  await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  const r = await supabase.from("push_subscriptions").insert({
    user_id: userId,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.p256dh,
    auth: parsed.data.auth,
    user_agent: parsed.data.userAgent ?? null,
  });
  if (!r.error) await supabase.from("notification_prefs").update({ enabled: true }).eq("user_id", userId);
  return { ok: !r.error };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const userId = await getUserId();
  if (!userId) return { ok: false };
  const supabase = await createClient();
  const r = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", userId);
  return { ok: !r.error };
}
