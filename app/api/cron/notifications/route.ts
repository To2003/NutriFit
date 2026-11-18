import { NextResponse, type NextRequest } from "next/server";
import { authorizeCron, forEachUser } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push/send";
import { inQuietHours, inWindow, waterSlot } from "@/lib/push/schedule";
import { loadDay } from "@/lib/data/day";
import { daysBetween, isoWeekday, timeInTz } from "@/lib/dates";
import { fmt1 } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Rec = Record<string, unknown>;
const obj = (j: unknown): Rec => (j && typeof j === "object" && !Array.isArray(j) ? (j as Rec) : {});

export async function POST(req: NextRequest) {
  const unauthorized = authorizeCron(req);
  if (unauthorized) return unauthorized;
  const admin = createAdminClient();
  let sent = 0;

  const result = await forEachUser(async (db, me) => {
    const n = me.notif;
    if (!n?.enabled) return;
    const now = timeInTz(me.tz);
    if (inQuietHours(now, n.quiet_from.slice(0, 5), n.quiet_to.slice(0, 5))) return;
    const today = me.today;
    const wd = isoWeekday(today);
    const water = obj(n.water);
    const meals = obj(n.meals);
    const gym = obj(n.gym);
    let day: Awaited<ReturnType<typeof loadDay>> | null = null;
    const getDay = async () => (day ??= await loadDay(db, me, today));

    // 💧 Agua
    if (water.on) {
      const slot = waterSlot(now, String(water.from ?? "09:00"), String(water.to ?? "21:00"), Number(water.every_h ?? 2));
      if (slot !== null) {
        const d = await getDay();
        const target = d.targets?.waterMl ?? 2500;
        if (d.waterMl < target)
          sent += await sendPush(admin, me.userId, "water", `water:${today}:${slot}`, {
            title: "Che, ¿y el agua? 💧",
            body: `Vas ${fmt1(d.waterMl / 1000)} de ${fmt1(target / 1000)} litros.`,
            url: "/inicio",
            tag: "water",
          });
      }
    }

    // 🍽️ Comidas
    if (meals.on) {
      for (const [meal, at, label] of [
        ["lunch", String(meals.lunch_by ?? "14:30"), "el almuerzo"],
        ["dinner", String(meals.dinner_by ?? "22:00"), "la cena"],
      ] as const) {
        if (!inWindow(now, at)) continue;
        const d = await getDay();
        if (!d.meals.some((m) => m.meal === meal))
          sent += await sendPush(admin, me.userId, "meal", `meal:${today}:${meal}`, {
            title: `¿Y ${label}? 🍽️`,
            body: "Cargalo en 3 toques: texto, foto o buscador.",
            url: "/diario?add=food",
            tag: "meal",
          });
      }
    }

    // 🏋️ Gym
    if (gym.on && me.gym?.weekdays?.includes(wd)) {
      const at = String(gym.at ?? me.gym?.preferred_time?.slice(0, 5) ?? "18:00");
      if (inWindow(now, at)) {
        const d = await getDay();
        if (!d.workouts.length)
          sent += await sendPush(admin, me.userId, "gym", `gym:${today}`, { title: "Hoy toca gym 🏋️", body: "Tu sesión está lista. Arrancá y el timer hace el resto.", url: "/entreno", tag: "gym" });
      }
    }

    // 👋 Solicitudes de seguimiento (últimos 30 min)
    if (n.follow_requests) {
      const since = new Date(Date.now() - 30 * 60_000).toISOString();
      const reqs = await db.from("follows").select("follower_id, created_at").eq("following_id", me.userId).eq("status", "pending").gte("created_at", since);
      for (const r of reqs.data ?? []) {
        const who = await db.from("profiles").select("username").eq("id", r.follower_id).maybeSingle();
        sent += await sendPush(admin, me.userId, "follow", `follow:${r.follower_id}:${r.created_at.slice(0, 16)}`, {
          title: "Nueva solicitud 👋",
          body: `@${who.data?.username ?? "alguien"} te quiere seguir.`,
          url: "/perfil/solicitudes",
        });
      }
    }

    // 📏 Toca medirte / toca test (lunes 10:00)
    if (n.measure_reminders && wd === 1 && inWindow(now, "10:00")) {
      const [m, t] = await Promise.all([
        db.from("body_measurements").select("log_date").eq("user_id", me.userId).order("log_date", { ascending: false }).limit(1).maybeSingle(),
        db.from("fitness_tests").select("log_date").eq("user_id", me.userId).order("log_date", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (!m.data || daysBetween(m.data.log_date, today) >= 14)
        sent += await sendPush(admin, me.userId, "measure", `measure:${today}`, { title: "Toca medirte 📏", body: "Cintura, cadera y compañía. Dos minutos con la cinta.", url: "/perfil/progreso" });
      if (!t.data || daysBetween(t.data.log_date, today) >= 28)
        sent += await sendPush(admin, me.userId, "test", `test:${today}`, { title: "Toca test ⏱️", body: "Salto, sprint y plancha: ¿cuánto mejoraste?", url: "/perfil/progreso" });
    }
  });

  return NextResponse.json({ ...result, sent });
}

export const GET = POST;
