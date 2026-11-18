import { describe, expect, it } from "vitest";
import { EXERCISE_LIBRARY, LIBRARY_BY_ID } from "./library-data";
import { allowedExercises, assignKinds, generateRulePlan, pickSessionDays, type GeneratorInput } from "./templates";
import { fixPlan, validatePlan } from "./rules";

const totoEvents = [
  { weekday: 2, sport: "volleyball", kind: "training" as const, durationMin: 120 },
  { weekday: 3, sport: "field_hockey", kind: "training" as const, durationMin: 90 },
  { weekday: 4, sport: "volleyball", kind: "training" as const, durationMin: 120 },
  { weekday: 5, sport: "field_hockey", kind: "training" as const, durationMin: 90 },
  { weekday: 6, sport: "volleyball", kind: "match" as const, durationMin: 120 },
  { weekday: 7, sport: "field_hockey", kind: "match" as const, durationMin: 70 },
];

const toto: GeneratorInput = {
  gymDays: [1, 3, 5],
  minutes: 60,
  experience: "intermediate",
  equipment: ["full_gym"],
  injuries: "",
  focusPrimary: "jump",
  focusSecondary: "injury_prevention",
  events: totoEvents,
  allowConsecutive: false,
  sports: ["volleyball", "field_hockey"],
};

describe("pickSessionDays", () => {
  it("sin días seguidos por defecto (D5)", () => {
    expect(pickSessionDays([1, 2, 3, 4], false)).toEqual([1, 3]);
    expect(pickSessionDays([1, 2, 3, 4], true)).toEqual([1, 2, 3, 4]);
    expect(pickSessionDays([1, 7], false)).toEqual([1]);
  });
});

describe("assignKinds", () => {
  it("Toto: lunes (MD+1) y viernes (MD-1) livianos; miércoles pierna", () => {
    const k = assignKinds([1, 3, 5], { gymDays: [1, 3, 5], events: totoEvents, allowConsecutive: false });
    expect(k[3]).toBe("lower_heavy");
    expect(k[5]).not.toBe("lower_heavy");
    expect(k[1]).not.toBe("lower_heavy");
  });
});

describe("generateRulePlan", () => {
  it("el plan de Toto cumple todas las reglas sin necesidad de corrección", () => {
    const plan = generateRulePlan(toto, EXERCISE_LIBRARY);
    const ctx = { gymDays: toto.gymDays, events: toto.events, allowConsecutive: false };
    expect(validatePlan(plan, ctx, LIBRARY_BY_ID)).toEqual([]);
    expect(plan.sessions).toHaveLength(3);
    for (const s of plan.sessions) expect(s.exercises.length).toBeGreaterThanOrEqual(4);
  });

  it("vóley suma prevención de hombro/rodilla y hockey de isquios/aductores", () => {
    const plan = generateRulePlan(toto, EXERCISE_LIBRARY);
    const ids = plan.sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId));
    const prevention = ids.filter((id) => LIBRARY_BY_ID[id].pattern === "prevention");
    expect(prevention.length).toBeGreaterThanOrEqual(2);
  });

  it("respeta el equipamiento", () => {
    const home: GeneratorInput = { ...toto, equipment: ["dumbbells", "bands"], gymDays: [2, 4, 6], events: [] };
    const plan = generateRulePlan(home, EXERCISE_LIBRARY);
    for (const s of plan.sessions)
      for (const e of s.exercises) {
        const info = LIBRARY_BY_ID[e.exerciseId];
        expect(info.equipment.every((q) => ["dumbbells", "bands"].includes(q)), e.exerciseId).toBe(true);
      }
  });

  it("con molestia de rodilla evita impacto alto", () => {
    const allowed = allowedExercises(EXERCISE_LIBRARY, { equipment: ["full_gym"], experience: "advanced", injuries: "tendón rotuliano derecho" });
    expect(allowed.some((e) => e.impact === "high")).toBe(false);
  });

  it("principiante no recibe ejercicios avanzados", () => {
    const plan = generateRulePlan({ ...toto, experience: "beginner" }, EXERCISE_LIBRARY);
    for (const s of plan.sessions) for (const e of s.exercises) expect(LIBRARY_BY_ID[e.exerciseId].level).toBe("beginner");
  });

  it("muchas combinaciones de agenda generan planes válidos (después de fixPlan)", () => {
    const focuses = ["jump", "power", "speed", "stamina", "max_strength", "hypertrophy", "recomp", "injury_prevention", "mobility"];
    for (const f of focuses)
      for (const days of [[1], [2, 4], [1, 3, 5], [1, 2, 3, 4, 5], [6, 7]])
        for (const allow of [false, true]) {
          const input = { ...toto, focusPrimary: f, gymDays: days, allowConsecutive: allow };
          const plan = generateRulePlan(input, EXERCISE_LIBRARY);
          const ctx = { gymDays: days, events: totoEvents, allowConsecutive: allow };
          const fixed = fixPlan(plan, ctx, LIBRARY_BY_ID).plan;
          expect(validatePlan(fixed, ctx, LIBRARY_BY_ID), `${f} ${days} ${allow}`).toEqual([]);
          expect(fixed.sessions.length, `${f} ${days}`).toBeGreaterThan(0);
        }
  });
});
