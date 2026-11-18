import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadMe, type Me } from "@/lib/data/me";
import type { ServerClient } from "@/lib/supabase/server";

export function authorizeCron(req: NextRequest): NextResponse | null {
  const secret = serverEnv().cronSecret.trim();
  // 500 = falta configurar CRON_SECRET en el deploy (o no se redeployó); 401 = el secreto no coincide
  if (!secret) return NextResponse.json({ error: "CRON_SECRET no está configurado en este deploy" }, { status: 500 });
  const auth = (req.headers.get("authorization") ?? "").trim();
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return null;
}

/** Itera usuarios con onboarding completo (service role). */
export async function forEachUser(fn: (admin: ServerClient, me: Me) => Promise<void>, opts: { limit?: number } = {}) {
  const admin = createAdminClient() as unknown as ServerClient;
  const { data } = await admin.from("profile_details").select("user_id").not("onboarded_at", "is", null).limit(opts.limit ?? 500);
  let ok = 0;
  let failed = 0;
  for (const row of data ?? []) {
    try {
      const me = await loadMe(admin, row.user_id);
      if (me) await fn(admin, me);
      ok++;
    } catch (e) {
      failed++;
      console.error("[cron] usuario falló", (e as Error).message);
    }
  }
  return { ok, failed };
}
