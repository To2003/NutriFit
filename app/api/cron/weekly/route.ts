import { NextResponse, type NextRequest } from "next/server";
import { authorizeCron, forEachUser } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateWeeklyReview } from "@/lib/agent/weekly";
import { sendPush } from "@/lib/push/send";
import { addDays, isoWeekday, timeInTz, weekStart } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const unauthorized = authorizeCron(req);
  if (unauthorized) return unauthorized;
  const admin = createAdminClient();
  let generated = 0;
  const result = await forEachUser(async (db, me) => {
    if (me.notif && me.notif.weekly_review === false) return;
    const wd = isoWeekday(me.today);
    const now = timeInTz(me.tz);
    // Domingo desde las 20 h, o lunes a la mañana si el domingo no se generó
    if (!((wd === 7 && now >= "20:00") || (wd === 1 && now < "12:00"))) return;
    const r = await generateWeeklyReview(db, me);
    if (!r) return;
    generated++;
    if (me.notif?.enabled)
      await sendPush(admin, me.userId, "weekly", `weekly:${wd === 7 ? weekStart(me.today) : addDays(weekStart(me.today), -7)}`, { title: "Tu revisión semanal está lista 📊", body: "Tendencia, adherencia y 3 objetivos para la semana.", url: "/inicio" });
  });
  return NextResponse.json({ ...result, generated });
}

export const GET = POST;
