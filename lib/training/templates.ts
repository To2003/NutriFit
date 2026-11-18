import { dayRestriction, cyclicDistance, plyoBudget, JUMP_SPORTS } from "./rules";
import type { ExerciseInfo, Pattern, PlacementContext, PlanExercise, PlanSession, SportEvent, WeekPlan } from "./types";

export type Experience = "beginner" | "intermediate" | "advanced";
export type SessionKind = "lower_heavy" | "upper" | "full" | "light";

export interface GeneratorInput {
  gymDays: number[];
  minutes: number;
  experience: Experience;
  equipment: string[];
  injuries: string;
  focusPrimary: string | null;
  focusSecondary: string | null;
  events: SportEvent[];
  allowConsecutive: boolean;
  sports: string[];
}

const LEVEL_RANK: Record<Experience, number> = { beginner: 0, intermediate: 1, advanced: 2 };

/** Elige los días de gym respetando D5 (sin días seguidos salvo que se permita). Máximo 5. */
export function pickSessionDays(gymDays: number[], allowConsecutive: boolean): number[] {
  const days = [...new Set(gymDays)].sort((a, b) => a - b).slice(0, 7);
  if (allowConsecutive) return days.slice(0, 5);
  const chosen: number[] = [];
  for (const d of days) {
    if (chosen.some((c) => cyclicDistance(c, d) === 1 || cyclicDistance(d, c) === 1)) continue;
    chosen.push(d);
  }
  return chosen.slice(0, 5);
}

export function exercisesPerSession(minutes: number): number {
  if (minutes <= 30) return 4;
  if (minutes <= 45) return 5;
  if (minutes <= 60) return 6;
  if (minutes <= 75) return 7;
  return 8;
}

/** Equipamiento disponible: "full_gym" habilita todo. */
export function hasEquipment(e: ExerciseInfo, equipment: string[]): boolean {
  if (equipment.includes("full_gym")) return true;
  const have = new Set([...equipment, "other"]);
  if (have.has("barbell")) have.add("rack");
  return e.equipment.every((q) => have.has(q));
}

const INJURY_RULES: { re: RegExp; avoid: (e: ExerciseInfo) => boolean }[] = [
  { re: /rodill|rotulian|menisc|ligament|lca|patel/i, avoid: (e) => e.impact === "high" || (e.pattern === "squat" && e.heavy_lower) },
  { re: /tobill|esguince|aquiles/i, avoid: (e) => e.impact === "high" },
  { re: /hombro|manguito|supraespin/i, avoid: (e) => e.pattern === "vertical_push" || e.id === "dips" || e.id === "power_clean" },
  { re: /lumbar|espalda baja|ci[aá]tic|hernia|disco/i, avoid: (e) => ["deadlift", "good_morning", "back_squat", "barbell_row", "power_clean"].includes(e.id) },
  { re: /isquio|femoral/i, avoid: (e) => e.id === "nordic_curl" || e.pattern === "sprint" },
  { re: /mu[ñn]eca/i, avoid: (e) => ["front_squat", "power_clean", "hang_power_clean", "pushup", "plyo_pushup"].includes(e.id) },
];

export function allowedExercises(lib: ExerciseInfo[], input: Pick<GeneratorInput, "equipment" | "experience" | "injuries">): ExerciseInfo[] {
  const rank = LEVEL_RANK[input.experience];
  const rules = INJURY_RULES.filter((r) => r.re.test(input.injuries));
  return lib.filter((e) => hasEquipment(e, input.equipment) && LEVEL_RANK[e.level] <= rank && !rules.some((r) => r.avoid(e)));
}

interface Slot {
  patterns: Pattern[];
  prefer?: (e: ExerciseInfo) => number;
  heavy?: boolean;
  noHeavy?: boolean;
  role: "main" | "secondary" | "accessory" | "plyo" | "prevention" | "core" | "conditioning" | "power" | "mobility";
}

function preventionPrefs(sports: string[]): (e: ExerciseInfo) => number {
  const volley = sports.some((s) => s.includes("volleyball"));
  const hockey = sports.includes("field_hockey") || sports.includes("football") || sports.includes("rugby");
  return (e) => {
    let s = 0;
    if (volley && (e.muscles.includes("rotator_cuff") || ["spanish_squat", "depth_landing", "ankle_isometric", "tibialis_raise"].includes(e.id))) s += 3;
    if (hockey && ["nordic_curl", "copenhagen_plank", "adductor_squeeze", "side_plank", "pallof_press"].includes(e.id)) s += 3;
    return s;
  };
}

function slotsFor(kind: SessionKind, input: GeneratorInput, allowPlyo: boolean): Slot[] {
  const focus = [input.focusPrimary, input.focusSecondary];
  const wantsPower = focus.includes("jump") || focus.includes("power") || focus.includes("speed");
  const wantsStamina = focus.includes("stamina") || focus.includes("recomp");
  const prev = preventionPrefs(input.sports);
  const lowerPrev = (e: ExerciseInfo) => prev(e) + (e.region === "lower" ? 1 : 0);
  const upperPrev = (e: ExerciseInfo) => prev(e) + (e.region === "upper" ? 1 : 0);
  switch (kind) {
    case "lower_heavy":
      return [
        ...(allowPlyo && wantsPower ? [{ patterns: ["plyometric"] as Pattern[], role: "plyo" as const }] : []),
        { patterns: ["squat", "hinge"], heavy: true, role: "main" },
        ...(wantsPower ? [{ patterns: ["power"] as Pattern[], role: "power" as const, prefer: (e: ExerciseInfo) => (e.region !== "upper" ? 1 : 0) }] : []),
        { patterns: ["hinge", "squat"], role: "secondary" },
        { patterns: ["lunge"], role: "secondary" },
        { patterns: ["prevention"], role: "prevention", prefer: lowerPrev },
        { patterns: ["accessory"], role: "accessory", prefer: (e) => (e.muscles.includes("calves") || e.muscles.includes("tibialis") ? 2 : 0) + (e.region === "lower" ? 1 : 0) },
        { patterns: ["core"], role: "core" },
        ...(wantsStamina ? [{ patterns: ["conditioning"] as Pattern[], role: "conditioning" as const }] : []),
      ];
    case "upper":
      return [
        { patterns: ["horizontal_push"], role: "main" },
        { patterns: ["horizontal_pull"], role: "main" },
        { patterns: ["vertical_pull"], role: "secondary" },
        { patterns: ["vertical_push"], role: "secondary" },
        { patterns: ["prevention"], role: "prevention", prefer: upperPrev },
        ...(wantsPower ? [{ patterns: ["power"] as Pattern[], role: "power" as const, prefer: (e: ExerciseInfo) => (e.region === "upper" ? 2 : 0) }] : []),
        { patterns: ["core"], role: "core" },
        { patterns: ["accessory"], role: "accessory", prefer: (e) => (e.region === "upper" ? 1 : 0) },
        ...(wantsStamina ? [{ patterns: ["conditioning"] as Pattern[], role: "conditioning" as const }] : []),
      ];
    case "full":
      return [
        ...(allowPlyo && wantsPower ? [{ patterns: ["plyometric"] as Pattern[], role: "plyo" as const }] : []),
        { patterns: ["squat", "hinge"], role: "main", heavy: true },
        { patterns: ["horizontal_push", "vertical_push"], role: "main" },
        { patterns: ["horizontal_pull", "vertical_pull"], role: "main" },
        { patterns: ["lunge", "hinge"], role: "secondary" },
        { patterns: ["prevention"], role: "prevention", prefer: prev },
        { patterns: ["core"], role: "core" },
        ...(wantsStamina ? [{ patterns: ["conditioning"] as Pattern[], role: "conditioning" as const }] : []),
      ];
    case "light":
      return [
        { patterns: ["mobility"], role: "mobility" },
        { patterns: ["horizontal_pull", "vertical_pull"], role: "secondary" },
        { patterns: ["horizontal_push", "vertical_push"], role: "secondary" },
        { patterns: ["prevention"], role: "prevention", prefer: upperPrev },
        { patterns: ["prevention"], role: "prevention", prefer: (e) => prev(e) + (e.region === "lower" && e.impact === "low" ? 1 : 0), noHeavy: true },
        { patterns: ["core"], role: "core" },
        { patterns: ["mobility"], role: "mobility" },
      ];
  }
}

function prescription(role: Slot["role"], input: GeneratorInput): Omit<PlanExercise, "exerciseId"> {
  const f = input.focusPrimary;
  const beginner = input.experience === "beginner";
  switch (role) {
    case "plyo":
      return { sets: 3, repsMin: 3, repsMax: 5, restS: 90, rir: null, notes: "Máxima calidad: cada salto al 100 %, aterrizaje suave." };
    case "power":
      return { sets: 3, repsMin: 3, repsMax: 5, restS: 120, rir: 3, notes: "Explosivo. Si se pone lento, cortá la serie." };
    case "main":
      if (f === "max_strength" && !beginner) return { sets: 4, repsMin: 3, repsMax: 5, restS: 180, rir: 2, notes: "" };
      if (f === "hypertrophy") return { sets: 3, repsMin: 8, repsMax: 12, restS: 120, rir: 2, notes: "" };
      if (f === "jump" || f === "power" || f === "speed") return { sets: 4, repsMin: 4, repsMax: 6, restS: 150, rir: 3, notes: "Subida explosiva, bajada controlada." };
      return { sets: 3, repsMin: 6, repsMax: 10, restS: 120, rir: 2, notes: "" };
    case "secondary":
      return { sets: 3, repsMin: 8, repsMax: 12, restS: 90, rir: 2, notes: "" };
    case "accessory":
      return { sets: 2, repsMin: 10, repsMax: 15, restS: 60, rir: 2, notes: "" };
    case "prevention":
      return { sets: 2, repsMin: 8, repsMax: 12, restS: 60, rir: 3, notes: "Lento y controlado." };
    case "core":
      return { sets: 3, repsMin: 8, repsMax: 12, restS: 60, rir: 2, notes: "" };
    case "conditioning":
      return { sets: 1, repsMin: 1, repsMax: 1, restS: 0, rir: null, notes: "10–12 min al final. Ver instrucciones." };
    case "mobility":
      return { sets: 2, repsMin: 6, repsMax: 10, restS: 30, rir: null, notes: "" };
  }
}

const SESSION_NAMES: Record<SessionKind, string> = {
  lower_heavy: "Piernas y potencia",
  upper: "Torso",
  full: "Cuerpo completo",
  light: "Activación y prevención",
};

/** Asigna un tipo de sesión a cada día según cercanía a partidos y cantidad de días. */
export function assignKinds(days: number[], ctx: PlacementContext): Record<number, SessionKind> {
  const out: Record<number, SessionKind> = {};
  const free = days.filter((d) => dayRestriction(d, ctx) === null);
  const restricted = days.filter((d) => dayRestriction(d, ctx) !== null);
  for (const d of restricted) out[d] = "light";
  if (free.length === 1) out[free[0]] = days.length === 1 ? "full" : "lower_heavy";
  else if (free.length === 2) {
    out[free[0]] = "lower_heavy";
    out[free[1]] = days.length >= 3 ? "upper" : "full";
    if (days.length <= 2) out[free[1]] = "upper";
  } else if (free.length >= 3) {
    // alterna pierna/torso; máximo 2 de pierna pesada
    let heavy = 0;
    free.forEach((d, i) => {
      if (i % 2 === 0 && heavy < 2) {
        out[d] = "lower_heavy";
        heavy++;
      } else out[d] = "upper";
    });
  }
  // con solo días restringidos, al menos uno de torso
  if (free.length === 0 && restricted.length) out[restricted[0]] = days.length === 1 ? "light" : "upper";
  return out;
}

export function generateRulePlan(input: GeneratorInput, lib: ExerciseInfo[]): WeekPlan {
  const ctx: PlacementContext = { gymDays: input.gymDays, events: input.events, allowConsecutive: input.allowConsecutive };
  const days = pickSessionDays(input.gymDays, input.allowConsecutive);
  const kinds = assignKinds(days, ctx);
  const pool = allowedExercises(lib, input);
  const budget = plyoBudget(input.events);
  const perSession = exercisesPerSession(input.minutes);
  const usedInWeek = new Map<string, number>();
  let plyoSessions = 0;
  const focus = [input.focusPrimary, input.focusSecondary].filter(Boolean) as string[];
  const jumpSport = input.sports.some((s) => JUMP_SPORTS.has(s));

  const sessions: PlanSession[] = days.map((weekday) => {
    const kind = kinds[weekday];
    const allowPlyo = plyoSessions < budget.maxSessions;
    const slots = slotsFor(kind, input, allowPlyo).slice(0, perSession);
    const chosen: PlanExercise[] = [];
    const usedHere = new Set<string>();
    for (const slot of slots) {
      const candidates = pool.filter(
        (e) =>
          slot.patterns.includes(e.pattern) &&
          !usedHere.has(e.id) &&
          (slot.heavy ? true : !e.heavy_lower || kind !== "light") &&
          !(slot.noHeavy && e.heavy_lower) &&
          !(kind === "light" && (e.heavy_lower || e.pattern === "plyometric" || e.impact === "high")),
      );
      if (!candidates.length) continue;
      const scored = candidates
        .map((e) => ({
          e,
          s:
            (slot.heavy && e.heavy_lower ? 3 : 0) +
            e.focus.filter((f) => focus.includes(f)).length * 2 +
            (slot.prefer?.(e) ?? 0) -
            (usedInWeek.get(e.id) ?? 0) * 2.5 -
            (jumpSport && e.pattern === "plyometric" && e.impact === "high" && e.id !== "box_jump" ? 0.5 : 0) +
            (input.experience === "beginner" && e.level === "beginner" ? 0.5 : 0),
        }))
        .sort((a, b) => b.s - a.s || a.e.id.localeCompare(b.e.id));
      const pick = scored[0].e;
      usedHere.add(pick.id);
      usedInWeek.set(pick.id, (usedInWeek.get(pick.id) ?? 0) + 1);
      const rx = prescription(slot.role, input);
      if (kind === "light") {
        // MD-1 / MD+1: tren superior liviano, lejos del fallo
        rx.sets = Math.min(rx.sets, 2);
        rx.rir = rx.rir == null ? null : Math.max(rx.rir, 3);
        if (slot.role === "secondary") rx.notes = "Liviano: pegado a un partido, que quede con resto.";
      }
      chosen.push({ exerciseId: pick.id, ...rx });
    }
    if (chosen.some((c) => lib.find((e) => e.id === c.exerciseId)?.pattern === "plyometric")) plyoSessions++;
    return { weekday, name: SESSION_NAMES[kind], exercises: chosen };
  });
  return { sessions: sessions.filter((s) => s.exercises.length > 0) };
}
