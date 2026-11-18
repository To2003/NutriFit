import { describe, expect, it } from "vitest";
import { cyclicDistance, fixPlan, matchProximity, plyoBudget, sessionFlags, validatePlan } from "./rules";
import type { ExerciseInfo, PlacementContext, WeekPlan } from "./types";

const ex = (id: string, over: Partial<ExerciseInfo>): ExerciseInfo => ({
  id,
  name: id,
  pattern: "accessory",
  region: "upper",
  muscles: [],
  equipment: [],
  focus: [],
  impact: "low",
  level: "beginner",
  unilateral: false,
  load_type: "barbell",
  heavy_lower: false,
  alternatives: [],
  ...over,
});

const LIB: Record<string, ExerciseInfo> = {
  back_squat: ex("back_squat", { pattern: "squat", region: "lower", heavy_lower: true, alternatives: ["goblet_squat"] }),
  goblet_squat: ex("goblet_squat", { pattern: "squat", region: "lower", load_type: "dumbbell" }),
  rdl: ex("rdl", { pattern: "hinge", region: "lower", heavy_lower: true, alternatives: ["hip_bridge"] }),
  hip_bridge: ex("hip_bridge", { pattern: "hinge", region: "lower", load_type: "bodyweight" }),
  box_jump: ex("box_jump", { pattern: "plyometric", region: "lower", impact: "high", load_type: "bodyweight" }),
  cmj: ex("cmj", { pattern: "plyometric", region: "lower", impact: "high", load_type: "bodyweight" }),
  bench: ex("bench", { pattern: "horizontal_push", region: "upper" }),
  row: ex("row", { pattern: "horizontal_pull", region: "upper" }),
  face_pull: ex("face_pull", { pattern: "prevention", region: "upper", load_type: "cable" }),
  dead_bug: ex("dead_bug", { pattern: "core", region: "core", load_type: "bodyweight" }),
};

const pe = (id: string, sets = 3) => ({ exerciseId: id, sets, repsMin: 5, repsMax: 8, restS: 120, rir: 2, notes: "" });

// Agenda de Toto: mar/jue vóley, mié/vie hockey, sáb partido vóley, dom partido hockey
const toto: PlacementContext = {
  gymDays: [1, 3, 5],
  allowConsecutive: false,
  events: [
    { weekday: 2, sport: "volleyball", kind: "training", durationMin: 120 },
    { weekday: 3, sport: "field_hockey", kind: "training", durationMin: 90 },
    { weekday: 4, sport: "volleyball", kind: "training", durationMin: 120 },
    { weekday: 5, sport: "field_hockey", kind: "training", durationMin: 90 },
    { weekday: 6, sport: "volleyball", kind: "match", durationMin: 120 },
    { weekday: 7, sport: "field_hockey", kind: "match", durationMin: 70 },
  ],
};

describe("cyclicDistance / matchProximity", () => {
  it("distancia hacia adelante en la semana (cíclica)", () => {
    expect(cyclicDistance(5, 6)).toBe(1);
    expect(cyclicDistance(7, 1)).toBe(1);
    expect(cyclicDistance(3, 3)).toBe(0);
  });
  it("MD, MD-1, MD+1 con partidos sáb y dom", () => {
    expect(matchProximity(5, [6, 7])).toEqual({ isMatchDay: false, daysToNext: 1, daysSinceLast: 5 });
    expect(matchProximity(1, [6, 7])).toEqual({ isMatchDay: false, daysToNext: 5, daysSinceLast: 1 });
    expect(matchProximity(6, [6, 7]).isMatchDay).toBe(true);
    expect(matchProximity(3, [])).toEqual({ isMatchDay: false, daysToNext: null, daysSinceLast: null });
  });
});

describe("sessionFlags", () => {
  it("deriva pierna pesada y pliometría de los ejercicios (no de lo que diga la IA)", () => {
    expect(sessionFlags({ weekday: 1, name: "Upper", exercises: [pe("back_squat"), pe("box_jump")] }, LIB)).toEqual({
      heavyLower: true,
      plyo: true,
      plyoSets: 3,
    });
    expect(sessionFlags({ weekday: 1, name: "x", exercises: [pe("bench")] }, LIB)).toEqual({ heavyLower: false, plyo: false, plyoSets: 0 });
  });
});

describe("validatePlan", () => {
  it("MD-1: nada de pierna pesada ni pliometría", () => {
    const plan: WeekPlan = { sessions: [{ weekday: 5, name: "Pierna", exercises: [pe("back_squat")] }] };
    const v = validatePlan(plan, toto, LIB);
    expect(v.map((x) => x.rule)).toContain("md_minus_1");
  });

  it("MD+1: sin pliometría ni pierna pesada", () => {
    const plan: WeekPlan = { sessions: [{ weekday: 1, name: "Saltos", exercises: [pe("box_jump")] }] };
    expect(validatePlan(plan, toto, LIB).map((x) => x.rule)).toContain("md_plus_1");
  });

  it("día de partido: nada pesado", () => {
    const plan: WeekPlan = { sessions: [{ weekday: 6, name: "Pierna", exercises: [pe("rdl")] }] };
    expect(validatePlan(plan, toto, LIB).map((x) => x.rule)).toContain("match_day");
  });

  it("máximo 2 sesiones de pierna pesada por semana", () => {
    const ctx: PlacementContext = { gymDays: [1, 3, 5], allowConsecutive: false, events: [] };
    const plan: WeekPlan = {
      sessions: [1, 3, 5].map((d) => ({ weekday: d, name: "Pierna", exercises: [pe("back_squat")] })),
    };
    expect(validatePlan(plan, ctx, LIB).map((x) => x.rule)).toContain("max_heavy_lower");
  });

  it("D5: sin días de gym seguidos salvo que el usuario lo permita", () => {
    const ctx: PlacementContext = { gymDays: [1, 2], allowConsecutive: false, events: [] };
    const plan: WeekPlan = {
      sessions: [
        { weekday: 1, name: "A", exercises: [pe("bench")] },
        { weekday: 2, name: "B", exercises: [pe("row")] },
      ],
    };
    expect(validatePlan(plan, ctx, LIB).map((x) => x.rule)).toContain("consecutive_days");
    expect(validatePlan(plan, { ...ctx, allowConsecutive: true }, LIB).map((x) => x.rule)).not.toContain("consecutive_days");
  });

  it("domingo y lunes cuentan como seguidos", () => {
    const ctx: PlacementContext = { gymDays: [7, 1], allowConsecutive: false, events: [] };
    const plan: WeekPlan = {
      sessions: [
        { weekday: 7, name: "A", exercises: [pe("bench")] },
        { weekday: 1, name: "B", exercises: [pe("row")] },
      ],
    };
    expect(validatePlan(plan, ctx, LIB).map((x) => x.rule)).toContain("consecutive_days");
  });

  it("sesión en un día que no es de gym", () => {
    const plan: WeekPlan = { sessions: [{ weekday: 4, name: "A", exercises: [pe("bench")] }] };
    expect(validatePlan(plan, toto, LIB).map((x) => x.rule)).toContain("not_gym_day");
  });

  it("deporte con muchos saltos baja el presupuesto de pliometría", () => {
    expect(plyoBudget(toto.events)).toEqual({ maxSessions: 1, maxSetsPerSession: 6 });
    expect(plyoBudget([])).toEqual({ maxSessions: 2, maxSetsPerSession: 10 });
    const plan: WeekPlan = { sessions: [{ weekday: 3, name: "Saltos", exercises: [pe("box_jump", 4), pe("cmj", 4)] }] };
    expect(validatePlan(plan, toto, LIB).map((x) => x.rule)).toContain("plyo_volume");
  });

  it("plan correcto para Toto no tiene violaciones", () => {
    const plan: WeekPlan = {
      sessions: [
        { weekday: 1, name: "Torso + core", exercises: [pe("bench"), pe("row"), pe("face_pull"), pe("dead_bug")] },
        { weekday: 3, name: "Pierna + saltos", exercises: [pe("back_squat"), pe("box_jump", 3), pe("rdl")] },
        { weekday: 5, name: "Torso liviano", exercises: [pe("row"), pe("face_pull")] },
      ],
    };
    expect(validatePlan(plan, toto, LIB)).toEqual([]);
  });
});

describe("fixPlan", () => {
  it("corrige sola una sesión pesada en MD-1 reemplazando por alternativas livianas", () => {
    const plan: WeekPlan = { sessions: [{ weekday: 5, name: "Pierna", exercises: [pe("back_squat"), pe("box_jump"), pe("bench")] }] };
    const { plan: fixed, changes } = fixPlan(plan, toto, LIB);
    expect(validatePlan(fixed, toto, LIB)).toEqual([]);
    const ids = fixed.sessions[0].exercises.map((e) => e.exerciseId);
    expect(ids).toContain("goblet_squat");
    expect(ids).not.toContain("box_jump");
    expect(changes.length).toBeGreaterThan(0);
  });

  it("si puede, intercambia sesiones entre días en vez de recortar", () => {
    const plan: WeekPlan = {
      sessions: [
        { weekday: 3, name: "Torso", exercises: [pe("bench"), pe("row")] },
        { weekday: 5, name: "Pierna", exercises: [pe("back_squat"), pe("rdl")] },
      ],
    };
    const { plan: fixed } = fixPlan(plan, { ...toto, gymDays: [3, 5] }, LIB);
    expect(validatePlan(fixed, { ...toto, gymDays: [3, 5] }, LIB)).toEqual([]);
    const wed = fixed.sessions.find((s) => s.weekday === 3)!;
    expect(wed.exercises.map((e) => e.exerciseId)).toContain("back_squat");
  });

  it("recorta la tercera sesión de pierna pesada", () => {
    const ctx: PlacementContext = { gymDays: [1, 3, 5], allowConsecutive: false, events: [] };
    const plan: WeekPlan = { sessions: [1, 3, 5].map((d) => ({ weekday: d, name: "Pierna", exercises: [pe("back_squat"), pe("rdl")] })) };
    const { plan: fixed } = fixPlan(plan, ctx, LIB);
    expect(validatePlan(fixed, ctx, LIB)).toEqual([]);
  });

  it("saca sesiones en días no permitidos o seguidos", () => {
    const ctx: PlacementContext = { gymDays: [1, 2, 4], allowConsecutive: false, events: [] };
    const plan: WeekPlan = {
      sessions: [
        { weekday: 1, name: "A", exercises: [pe("bench")] },
        { weekday: 2, name: "B", exercises: [pe("row")] },
        { weekday: 4, name: "C", exercises: [pe("bench")] },
        { weekday: 6, name: "D", exercises: [pe("row")] },
      ],
    };
    const { plan: fixed } = fixPlan(plan, ctx, LIB);
    expect(validatePlan(fixed, ctx, LIB)).toEqual([]);
    expect(fixed.sessions.length).toBe(2);
  });

  it("recorta series pliométricas al presupuesto", () => {
    const plan: WeekPlan = { sessions: [{ weekday: 3, name: "Saltos", exercises: [pe("box_jump", 5), pe("cmj", 5)] }] };
    const { plan: fixed } = fixPlan(plan, toto, LIB);
    expect(validatePlan(fixed, toto, LIB)).toEqual([]);
  });
});
