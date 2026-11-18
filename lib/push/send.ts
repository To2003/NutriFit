import "server-only";
import * as webpush from "web-push";
import { publicEnv, serverEnv } from "@/lib/env";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const env = serverEnv();
  if (!publicEnv.vapidPublicKey || !env.vapidPrivateKey) return false;
  webpush.setVapidDetails(env.vapidSubject, publicEnv.vapidPublicKey, env.vapidPrivateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Envía a todas las suscripciones del usuario, una sola vez por `dedupeKey`
 * (notification_log tiene unique(user_id, dedupe_key)). Limpia suscripciones vencidas.
 */
export async function sendPush(admin: Admin, userId: string, kind: string, dedupeKey: string, payload: PushPayload): Promise<number> {
  if (!configure()) return 0;
  const lock = await admin.from("notification_log").insert({ user_id: userId, dedupe_key: dedupeKey, kind });
  if (lock.error) return 0; // ya enviado
  const subs = await admin.from("push_subscriptions").select("*").eq("user_id", userId);
  let sent = 0;
  for (const s of subs.data ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600, urgency: "normal" });
      sent++;
      await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).eq("id", s.id);
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
  return sent;
}
