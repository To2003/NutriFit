import "server-only";
import { demo, DEMO_FRIEND, DEMO_USER } from "./store";
import { FOODS_AR } from "@/lib/food/foods-ar-data";
import { EXERCISE_LIBRARY, LIBRARY_BY_ID } from "@/lib/training/library-data";
import { ACHIEVEMENTS } from "@/lib/gamification/achievements-data";
import { generateRulePlan } from "@/lib/training/templates";
import { addDays, DEFAULT_TZ, isoWeekday, todayInTz, weekStart } from "@/lib/dates";
import { normalize } from "@/lib/text";
import { buildTargetInputs, computeWeek, weekToStored } from "@/lib/data/targets";
import { expandMesocycle } from "@/lib/training/mesocycle";

type Row = Record<string, unknown>;
const FLOR = "00000000-0000-4000-8000-0000000f1000";

/** Carga una semana de datos de ejemplo (perfil de Toto) la primera vez que se usa el modo demo. */
export function ensureDemoSeed(): Promise<void> {
  demo.seeded ??= seed().catch((e) => {
    demo.seeded = null; // reintentar en el próximo request
    throw e;
  });
  return demo.seeded;
}

async function seed() {
  const T = demo.tables;
  const today = todayInTz(DEFAULT_TZ);
  const now = new Date().toISOString();
  const at = (date: string, hm: string) => new Date(`${date}T${hm}:00-03:00`).toISOString();

  T.exercises = EXERCISE_LIBRARY.map((e) => ({ ...e, instructions: "", common_mistakes: "" }));
  T.achievements = ACHIEVEMENTS.map((a, i) => ({ ...a, sort: i }));
  T.foods = FOODS_AR.map(([name, aliases, kcal, p, c, f, fib, portions]) => ({
    id: crypto.randomUUID(),
    name,
    brand: null,
    source: "local",
    external_id: null,
    kcal,
    protein_g: p,
    carbs_g: c,
    fat_g: f,
    fiber_g: fib,
    portions: [...portions.map(([label, grams]) => ({ label, grams })), { label: "100 g", grams: 100 }],
    aliases,
    verified: false,
    created_by: null,
    search_name: normalize(name),
    created_at: now,
  }));

  // ── Perfiles ──
  T.profiles = [
    { id: DEMO_USER, username: "toto", display_name: "Toto", avatar_url: null, bio: "Punta 🏐 en el club, hockey los domingos.", is_private: false, created_at: now },
    { id: DEMO_FRIEND, username: "juanpi", display_name: "Juanpi", avatar_url: null, bio: "Central. Salto o muerte.", is_private: false, created_at: now },
    { id: FLOR, username: "flor.hockey", display_name: "Flor", avatar_url: null, bio: "Volante 🏑", is_private: true, created_at: now },
  ];
  const details = (user_id: string, extra: Row) => ({
    user_id,
    birthdate: "2003-05-14",
    sex: "male",
    height_cm: 185,
    goal: "lose_fat",
    pace: "moderate",
    lifestyle: "mixed",
    focus_primary: "jump",
    focus_secondary: "injury_prevention",
    timezone: DEFAULT_TZ,
    water_glass_ml: 250,
    water_bottle_ml: 750,
    ai_notice_accepted_at: now,
    onboarding_step: 11,
    onboarded_at: now,
    updated_at: now,
    ...extra,
  });
  T.profile_details = [details(DEMO_USER, {}), details(DEMO_FRIEND, { birthdate: "2002-02-01", height_cm: 196, goal: "performance" }), details(FLOR, { sex: "female", height_cm: 168 })];
  T.privacy_settings = [DEMO_USER, DEMO_FRIEND, FLOR].map((u) => ({ user_id: u, show_streaks: true, show_training: true, show_tests: true, show_meals: false, show_body: false }));
  T.user_sports = [
    { id: crypto.randomUUID(), user_id: DEMO_USER, sport: "volleyball", position: "Punta", level: "amateur" },
    { id: crypto.randomUUID(), user_id: DEMO_USER, sport: "field_hockey", position: "Volante", level: "recreational" },
    { id: crypto.randomUUID(), user_id: DEMO_FRIEND, sport: "volleyball", position: "Central", level: "federated" },
    { id: crypto.randomUUID(), user_id: FLOR, sport: "field_hockey", position: "Volante", level: "amateur" },
  ];
  const sched = (wd: number, sport: string, kind: string, time: string, min: number, intensity: string) => ({ id: crypto.randomUUID(), user_id: DEMO_USER, weekday: wd, sport, kind, start_time: `${time}:00`, duration_min: min, intensity, created_at: now });
  T.weekly_schedule = [
    sched(2, "volleyball", "training", "20:00", 120, "moderate"),
    sched(3, "field_hockey", "training", "19:00", 90, "moderate"),
    sched(4, "volleyball", "training", "20:00", 120, "moderate"),
    sched(5, "field_hockey", "training", "19:00", 90, "moderate"),
    sched(6, "volleyball", "match", "16:00", 120, "hard"),
    sched(7, "field_hockey", "match", "11:00", 70, "hard"),
  ];
  T.gym_preferences = [
    { user_id: DEMO_USER, weekdays: [1, 3, 5], minutes: 60, preferred_time: "08:00:00", equipment: ["full_gym"], experience: "intermediate", injuries: "", allow_consecutive: false },
    { user_id: DEMO_FRIEND, weekdays: [1, 4], minutes: 75, preferred_time: "09:00:00", equipment: ["full_gym"], experience: "advanced", injuries: "", allow_consecutive: false },
  ];
  T.diet_preferences = [{ user_id: DEMO_USER, diet_type: "omnivore", meals_per_day: 4, dislikes: ["hígado"], allergies: "", cooking_time: "normal" }];
  T.notification_prefs = [
    {
      user_id: DEMO_USER,
      enabled: true,
      water: { on: true, every_h: 2, from: "09:00", to: "21:00" },
      meals: { on: true, lunch_by: "14:30", dinner_by: "22:00" },
      gym: { on: true, at: "08:00" },
      daily_close: { on: true, at: "22:00" },
      weekly_review: true,
      follow_requests: true,
      measure_reminders: true,
      quiet_from: "23:30:00",
      quiet_to: "08:00:00",
    },
  ];

  // ── Peso: 40 días bajando ~0,35 kg/semana con ruido ──
  T.weight_logs = [];
  for (let i = 39; i >= 0; i--) {
    if (i % 3 === 1) continue; // no se pesa todos los días
    const kg = 86.4 - (39 - i) * 0.05 + Math.sin(i * 1.9) * 0.45;
    T.weight_logs.push({ id: crypto.randomUUID(), user_id: DEMO_USER, log_date: addDays(today, -i), kg: Math.round(kg * 10) / 10, created_at: now });
  }

  // ── Objetivos ──
  const inputs = buildTargetInputs({ details: T.profile_details[0] as never, weightKg: 84.8, schedule: T.weekly_schedule as never, gym: T.gym_preferences[0] as never, goals: null })!;
  const week = computeWeek(inputs);
  T.user_goals = [
    {
      id: crypto.randomUUID(),
      user_id: DEMO_USER,
      goal: "lose_fat",
      pace: "moderate",
      lifestyle: "mixed",
      targets: weekToStored(week),
      manual_override: false,
      tdee_estimate: Math.round(Object.values(week.days).reduce((s, d) => s + d.expenditureKcal, 0) / 7),
      expenditure_offset_kcal: 0,
      effective_from: addDays(today, -30),
      created_at: at(addDays(today, -30), "10:00"),
    },
  ];

  // ── Comidas (14 días) ──
  const food = (name: string) => T.foods.find((f) => f.name === name)!;
  const menus: [string, [string, number][]][][] = [
    [["breakfast", [["Café con leche", 250], ["Pan lactal integral", 50], ["Queso untable light", 30]]], ["lunch", [["Milanesa de pollo al horno", 150], ["Puré de papas", 200], ["Ensalada mixta", 150]]], ["snack", [["Yogur alto en proteína", 160], ["Banana", 120]]], ["dinner", [["Fideos con tuco", 320], ["Queso rallado", 10]]]],
    [["breakfast", [["Mate cocido con leche", 250], ["Tostado de jamón y queso", 150]]], ["lunch", [["Pechuga de pollo a la plancha", 170], ["Arroz blanco cocido", 200], ["Ensalada mixta con aceite", 200]]], ["snack", [["Licuado de banana con leche", 300]]], ["dinner", [["Pizza muzzarella", 240], ["Coca-Cola", 354]]]],
    [["breakfast", [["Yogur alto en proteína", 160], ["Granola", 40], ["Banana", 120]]], ["lunch", [["Bife de chorizo", 220], ["Papas al horno", 250]]], ["snack", [["Mate (cebado, sin azúcar)", 500], ["Galletitas de arroz", 27], ["Queso cremoso", 30]]], ["dinner", [["Merluza al horno", 200], ["Zapallo / calabaza", 250]]]],
  ];
  T.food_logs = [];
  T.food_log_items = [];
  T.water_logs = [];
  const times: Record<string, string> = { breakfast: "08:30", lunch: "13:15", snack: "17:30", dinner: "21:30" };
  for (let i = 13; i >= 0; i--) {
    const date = addDays(today, -i);
    const menu = menus[i % menus.length];
    const meals = i === 0 ? menu.slice(0, 3) : i === 9 ? menu.slice(0, 2) : menu;
    for (const [meal, items] of meals) {
      const id = crypto.randomUUID();
      T.food_logs.push({ id, user_id: DEMO_USER, log_date: date, meal, photo_path: null, input_text: null, origin: i % 2 ? "text" : "search", created_at: at(date, times[meal]) });
      for (const [name, grams] of items) {
        const f = food(name);
        const k = grams / 100;
        T.food_log_items.push({
          id: crypto.randomUUID(),
          food_log_id: id,
          user_id: DEMO_USER,
          food_id: f.id,
          name,
          grams,
          kcal: Math.round(Number(f.kcal) * k),
          protein_g: Math.round(Number(f.protein_g) * k * 10) / 10,
          carbs_g: Math.round(Number(f.carbs_g) * k * 10) / 10,
          fat_g: Math.round(Number(f.fat_g) * k * 10) / 10,
          source: "local",
          confidence: null,
          created_at: at(date, times[meal]),
        });
      }
    }
    const glasses = i === 0 ? 7 : 12 + (i % 5);
    for (let w = 0; w < glasses; w++) T.water_logs.push({ id: crypto.randomUUID(), user_id: DEMO_USER, log_date: date, ml: 250, logged_at: at(date, `${String(Math.floor((540 + w * 48) / 60)).padStart(2, "0")}:${String((540 + w * 48) % 60).padStart(2, "0")}`) });
  }

  // ── Actividad: la agenda se cumplió los días pasados ──
  T.activity_logs = [];
  for (let i = 13; i >= 1; i--) {
    const date = addDays(today, -i);
    for (const s of T.weekly_schedule.filter((x) => x.weekday === isoWeekday(date)))
      T.activity_logs.push({ id: crypto.randomUUID(), user_id: DEMO_USER, log_date: date, sport: s.sport, kind: s.kind, status: "done", duration_min: s.duration_min, intensity: s.intensity, met: 5, kcal: 600, schedule_id: s.id, created_at: now });
  }

  // ── Rutina: mesociclo arrancado la semana pasada ──
  T.programs = [];
  T.program_sessions = [];
  T.program_exercises = [];
  T.workout_sessions = [];
  T.set_logs = [];
  const events = T.weekly_schedule.map((s) => ({ weekday: s.weekday as number, sport: s.sport as string, kind: s.kind as "training" | "match", durationMin: s.duration_min as number }));
  const savePlan = (user: string, plan: ReturnType<typeof generateRulePlan>, startDate: string, name: string) => {
    const pid = crypto.randomUUID();
    T.programs.push({ id: pid, user_id: user, name, focus_primary: "jump", focus_secondary: "injury_prevention", start_date: startDate, weeks: 4, status: "active", source: "rules", copied_from: null, notes: "Lo pesado va el miércoles, lejos de los partidos. Lunes y viernes, activación y prevención: hombro para el remate, tobillo y aductores para el hockey.", created_at: now });
    const mains = new Set(plan.sessions.flatMap((s) => s.exercises.filter((e) => ["squat", "hinge", "horizontal_push", "horizontal_pull", "vertical_pull"].includes(LIBRARY_BY_ID[e.exerciseId].pattern)).map((e) => e.exerciseId)));
    const ids: Record<string, string> = {};
    for (const w of expandMesocycle(plan, { mainExerciseIds: mains })) {
      for (const s of w.sessions) {
        const sid = crypto.randomUUID();
        ids[`${w.week}-${s.weekday}`] = sid;
        T.program_sessions.push({ id: sid, program_id: pid, user_id: user, week: w.week, weekday: s.weekday, name: s.name, tags: [], is_deload: w.isDeload, created_at: now });
        s.exercises.forEach((e, i) =>
          T.program_exercises.push({ id: crypto.randomUUID(), session_id: sid, user_id: user, exercise_id: e.exerciseId, position: i + 1, sets: e.sets, reps_min: e.repsMin, reps_max: e.repsMax, rest_s: e.restS, rir: e.rir, notes: e.notes }),
        );
      }
    }
    return ids;
  };
  const totoPlan = generateRulePlan(
    { gymDays: [1, 3, 5], minutes: 60, experience: "intermediate", equipment: ["full_gym"], injuries: "", focusPrimary: "jump", focusSecondary: "injury_prevention", events, allowConsecutive: false, sports: ["volleyball", "field_hockey"] },
    EXERCISE_LIBRARY,
  );
  const start = addDays(weekStart(today), -7);
  const sessionIds = savePlan(DEMO_USER, totoPlan, start, "Mesociclo Salto vertical");
  savePlan(DEMO_FRIEND, generateRulePlan({ gymDays: [1, 4], minutes: 75, experience: "advanced", equipment: ["full_gym"], injuries: "", focusPrimary: "power", focusSecondary: "jump", events: [], allowConsecutive: false, sports: ["volleyball"] }, EXERCISE_LIBRARY), start, "Bloque de potencia");

  // Semana 1 hecha (con cargas) + lo que va de esta semana
  const loads: Record<string, number> = { back_squat: 95, bench_press: 70, pullup: 0, bulgarian_split_squat: 16, chest_supported_row: 18, landmine_press: 20, single_leg_rdl: 16, jump_squat: 10 };
  for (const s of totoPlan.sessions) {
    for (const wk of [1, 2]) {
      const date = addDays(start, (wk - 1) * 7 + s.weekday - 1);
      if (date >= today) continue;
      const wid = crypto.randomUUID();
      T.workout_sessions.push({ id: wid, user_id: DEMO_USER, program_session_id: sessionIds[`${wk}-${s.weekday}`], log_date: date, started_at: at(date, "08:05"), ended_at: at(date, "09:02"), duration_min: 57, feeling: 7 + (s.weekday % 2), volume_kg: 0, notes: "" });
      let vol = 0;
      for (const e of s.exercises) {
        const base = loads[e.exerciseId] ?? (LIBRARY_BY_ID[e.exerciseId].load_type === "bodyweight" ? 0 : 12);
        const kg = base + (wk === 2 && e.exerciseId === "back_squat" ? 5 : 0);
        for (let n = 1; n <= e.sets; n++) {
          T.set_logs.push({ id: crypto.randomUUID(), workout_session_id: wid, user_id: DEMO_USER, exercise_id: e.exerciseId, set_number: n, kg, reps: e.repsMax, rir: 2, created_at: at(date, "08:30") });
          vol += kg * e.repsMax;
        }
      }
      T.workout_sessions[T.workout_sessions.length - 1].volume_kg = vol;
    }
  }

  // ── Tests y medidas ──
  T.fitness_tests = [
    { id: crypto.randomUUID(), user_id: DEMO_USER, log_date: addDays(today, -33), test: "cmj", value: 49.5, unit: "cm", created_at: now },
    { id: crypto.randomUUID(), user_id: DEMO_USER, log_date: addDays(today, -5), test: "cmj", value: 52, unit: "cm", created_at: now },
    { id: crypto.randomUUID(), user_id: DEMO_USER, log_date: addDays(today, -5), test: "reach_jump", value: 318, unit: "cm", created_at: now },
    { id: crypto.randomUUID(), user_id: DEMO_USER, log_date: addDays(today, -5), test: "sprint_10", value: 1.86, unit: "s", created_at: now },
    { id: crypto.randomUUID(), user_id: DEMO_FRIEND, log_date: addDays(today, -6), test: "cmj", value: 61, unit: "cm", created_at: now },
  ];
  T.body_measurements = [
    { id: crypto.randomUUID(), user_id: DEMO_USER, log_date: addDays(today, -31), waist_cm: 88, hip_cm: 99, chest_cm: 104, arm_cm: 35.5, thigh_cm: 60, neck_cm: 39, created_at: now },
    { id: crypto.randomUUID(), user_id: DEMO_USER, log_date: addDays(today, -16), waist_cm: 86.5, hip_cm: 98.5, chest_cm: 104, arm_cm: 35.5, thigh_cm: 60, neck_cm: 39, created_at: now },
  ];

  // ── Agente, objetivos semanales, logros, social ──
  const ws = weekStart(today);
  T.agent_messages = [
    { id: crypto.randomUUID(), user_id: DEMO_USER, kind: "weekly_review", for_date: addDays(ws, -7), source: "fallback", content: { text: "Tendencia: 84,9 kg (−0,4 en la semana). Cargaste 6 de 7 días y llegaste a la proteína 5. Hiciste 3 de 3 sesiones y rompiste récord en sentadilla trasera. 🔥" }, created_at: at(addDays(ws, -1), "21:00") },
    { id: crypto.randomUUID(), user_id: DEMO_USER, kind: "daily_close", for_date: addDays(today, -1), source: "fallback", content: { resumen: "Comiste 96 % de tu objetivo y tomaste todo el agua.", bien: "La proteína quedó al día.", ajuste: "Mañana repetimos la receta: viene funcionando.", text: "" }, created_at: at(addDays(today, -1), "22:00") },
    { id: crypto.randomUUID(), user_id: DEMO_USER, kind: "log_feedback", for_date: today, source: "fallback", content: { text: "Vas bárbaro con la proteína. Hoy a la noche hay vóley: cená con carbos, arroz o fideos, y llegás con nafta." }, created_at: now },
  ];
  T.weekly_goals = [
    { id: crypto.randomUUID(), user_id: DEMO_USER, week_start: ws, text: "Llegar a la proteína 5 de 7 días", done: true, evaluated: false, created_at: now },
    { id: crypto.randomUUID(), user_id: DEMO_USER, week_start: ws, text: "Cumplir el agua 5 días (botella siempre a mano)", done: false, evaluated: false, created_at: now },
    { id: crypto.randomUUID(), user_id: DEMO_USER, week_start: ws, text: "Dormir 8 h antes de los partidos", done: false, evaluated: false, created_at: now },
  ];
  const tdee = Number(T.user_goals[0].tdee_estimate);
  T.tdee_proposals = [{ id: crypto.randomUUID(), user_id: DEMO_USER, week_start: addDays(ws, -7), previous_tdee: tdee, observed_tdee: tdee + 230, proposed_tdee: tdee + 110, status: "pending", created_at: now }];
  T.user_achievements = ["first_log", "first_workout", "first_pr", "streak_7", "first_test", "water_7"].map((code, i) => ({ user_id: DEMO_USER, code, unlocked_at: at(addDays(today, -12 + i * 2), "21:00") }));
  T.user_achievements.push({ user_id: DEMO_FRIEND, code: "streak_30", unlocked_at: now }, { user_id: DEMO_FRIEND, code: "jump_plus_5", unlocked_at: now });
  T.user_streaks = [];
  T.follows = [
    { follower_id: DEMO_FRIEND, following_id: DEMO_USER, status: "accepted", created_at: now, accepted_at: now },
    { follower_id: DEMO_USER, following_id: DEMO_FRIEND, status: "accepted", created_at: now, accepted_at: now },
    { follower_id: FLOR, following_id: DEMO_USER, status: "pending", created_at: now, accepted_at: null },
  ];
  T.blocks = [];
  T.pain_reports = [];
  T.push_subscriptions = [];
  T.notification_log = [];
  T.ai_usage = [];

  // Rachas de Juanpi (para su perfil)
  T.user_streaks.push(
    { user_id: DEMO_FRIEND, kind: "logging", current: 31, best: 31, last_date: today },
    { user_id: DEMO_FRIEND, kind: "water", current: 12, best: 20, last_date: today },
    { user_id: DEMO_FRIEND, kind: "protein", current: 9, best: 15, last_date: today },
    { user_id: DEMO_FRIEND, kind: "training_week", current: 4, best: 4, last_date: today },
  );
}
