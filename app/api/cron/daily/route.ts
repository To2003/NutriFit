import { NextResponse, type NextRequest } from "next/server";
import { authorizeCron, forEachUser } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDailyClose } from "@/lib/agent/daily";
import { sendPush } from "@/lib/push/send";
import { inWindow, inQuietHours } from "@/lib/push/schedule";
import { timeInTz } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const unauthorized = authorizeCron(req);
  if (unauthorized) return unauthorized;
  const admin = createAdminClient();
  let generated = 0;
  const result = await forEachUser(async (db, me) => {
    const close = (me.notif?.daily_close ?? {}) as { on?: boolean; at?: string };
    if (close.on === false) return;
    const at = close.at ?? "22:00";
    const now = timeInTz(me.tz);
    if (!inWindow(now, at, 60)) return;
    const r = await generateDailyClose(db, me, me.today);
    if (!r) return;
    generated++;
    if (me.notif?.enabled && !inQuietHours(now, me.notif.quiet_from.slice(0, 5), me.notif.quiet_to.slice(0, 5)))
      await sendPush(admin, me.userId, "daily_close", `close:${me.today}`, { title: "Tu cierre del día está listo 🌙", body: r.bien, url: "/inicio" });
  });
  return NextResponse.json({ ...result, generated });
}

export const GET = POST;
