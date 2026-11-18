import type { ExerciseInfo, PlacementContext, PlanSession, SportEvent, WeekPlan } from "./types";

/** Deportes con mucho salto: su carga cuenta para el volumen pliométrico del gym. */
export const JUMP_SPORTS = new Set(["volleyball", "beach_volleyball", "basketball", "handball"]);
export const MAX_HEAVY_LOWER_PER_WEEK = 2;

export type Rule =
  | "match_day"
  | "md_minus_1"
  | "md_plus_1"
  | "max_heavy_lower"
  | "consecutive_days"
  | "not_gym_day"
  | "duplicate_day"
  | "plyo_volume";

export interface Violation {
  rule: Rule;
  weekday: number;
  message: string;
}

/** Días hacia adelante desde `from` hasta `to` en una semana cíclica (0–6). */
export function cyclicDistance(from: number, to: number): number {
  return (((to - from) % 7) + 7) % 7;
}

export function matchProximity(
  weekday: number,
  matchDays: number[],
): { isMatchDay: boolean; daysToNext: number | null; daysSinceLast: number | null } {
  if (matchDays.length === 0) return { isMatchDay: false, daysToNext: null, daysSinceLast: null };
  const toNext = matchDays.map((m) => cyclicDistance(weekday, m)).filter((d) => d > 0);
  const since = matchDays.map((m) => cyclicDistance(m, weekday)).filter((d) => d > 0);
  return {
    isMatchDay: matchDays.includes(weekday),
    daysToNext: toNext.length ? Math.min(...toNext) : 7,
    daysSinceLast: since.length ? Math.min(...since) : 7,
  };
}

export function sessionFlags(s: PlanSession, lib: Record<string, ExerciseInfo>) {
  let heavyLower = false;
  let plyoSets = 0;
  for (const e of s.exercises) {
    const info = lib[e.exerciseId];
    if (!info) continue;
    if (info.heavy_lower) heavyLower = true;
    if (info.pattern === "plyometric") plyoSets += e.sets;
  }
  return { heavyLower, plyo: plyoSets > 0, plyoSets };
}

export function plyoBudget(events: SportEvent[]): { maxSessions: number; maxSetsPerSession: number } {
  const jumpSessions = events.filter((e) => JUMP_SPORTS.has(e.sport)).length;
  if (jumpSessions >= 3) return { maxSessions: 1, maxSetsPerSession: 6 };
  if (jumpSessions >= 1) return { maxSessions: 2, maxSetsPerSession: 8 };
  return { maxSessions: 2, maxSetsPerSession: 10 };
}

/** ¿Qué restricción tiene este día por cercanía a un partido? */
export function dayRestriction(weekday: number, ctx: PlacementContext): Rule | null {
  const matchDays = [...new Set(ctx.events.filter((e) => e.kind === "match").map((e) => e.weekday))];
  const p = matchProximity(weekday, matchDays);
  if (p.isMatchDay) return "match_day";
  if (p.daysToNext === 1) return "md_minus_1";
  if (p.daysSinceLast === 1) return "md_plus_1";
  return null;
}

const RESTRICTION_MSG: Record<string, string> = {
  match_day: "El día de partido no va pierna pesada ni saltos.",
  md_minus_1: "El día antes del partido no va pierna pesada ni pliometría.",
  md_plus_1: "El día después del partido es para recuperar: sin saltos ni pierna pesada.",
};

export function validatePlan(plan: WeekPlan, ctx: PlacementContext, lib: Record<string, ExerciseInfo>): Violation[] {
  const v: Violation[] = [];
  const seen = new Set<number>();
  for (const s of plan.sessions) {
    if (seen.has(s.weekday)) v.push({ rule: "duplicate_day", weekday: s.weekday, message: "Dos sesiones el mismo día." });
    seen.add(s.weekday);
    if (!ctx.gymDays.includes(s.weekday)) v.push({ rule: "not_gym_day", weekday: s.weekday, message: "Ese día no tenés gym." });
    const f = sessionFlags(s, lib);
    const r = dayRestriction(s.weekday, ctx);
    if (r && (f.heavyLower || f.plyo)) v.push({ rule: r, weekday: s.weekday, message: RESTRICTION_MSG[r] });
  }

  const heavy = plan.sessions.filter((s) => sessionFlags(s, lib).heavyLower);
  if (heavy.length > MAX_HEAVY_LOWER_PER_WEEK)
    v.push({ rule: "max_heavy_lower", weekday: heavy[MAX_HEAVY_LOWER_PER_WEEK].weekday, message: "Más de 2 sesiones de pierna pesada en la semana." });

  if (!ctx.allowConsecutive) {
    const days = [...new Set(plan.sessions.map((s) => s.weekday))].sort((a, b) => a - b);
    for (const a of days)
      for (const b of days)
        if (a !== b && cyclicDistance(a, b) === 1)
          v.push({ rule: "consecutive_days", weekday: b, message: "Sesiones de gym en días seguidos." });
  }

  const budget = plyoBudget(ctx.events);
  const plyoSessions = plan.sessions.filter((s) => sessionFlags(s, lib).plyo);
  if (plyoSessions.length > budget.maxSessions)
    v.push({ rule: "plyo_volume", weekday: plyoSessions[budget.maxSessions].weekday, message: "Demasiadas sesiones con saltos para tu semana de deporte." });
  for (const s of plyoSessions)
    if (sessionFlags(s, lib).plyoSets > budget.maxSetsPerSession)
      v.push({ rule: "plyo_volume", weekday: s.weekday, message: "Mucho volumen de saltos: tu deporte ya salta un montón." });
  return v;
}

// ── Corrección automática ────────────────────────────────────────────────────

const clone = (p: WeekPlan): WeekPlan => ({ sessions: p.sessions.map((s) => ({ ...s, exercises: s.exercises.map((e) => ({ ...e })) })) });

/** Distancia (en días) al partido más cercano, para priorizar qué sesión conserva lo pesado. */
function matchDistance(weekday: number, ctx: PlacementContext): number {
  const matchDays = ctx.events.filter((e) => e.kind === "match").map((e) => e.weekday);
  if (!matchDays.length) return 7;
  const p = matchProximity(weekday, matchDays);
  return Math.min(p.daysToNext ?? 7, p.daysSinceLast ?? 7, p.isMatchDay ? 0 : 7);
}

function lightAlternative(id: string, lib: Record<string, ExerciseInfo>, banned: Set<string>): string | null {
  const info = lib[id];
  if (!info) return null;
  for (const alt of info.alternatives) {
    const a = lib[alt];
    if (a && !a.heavy_lower && a.pattern !== "plyometric" && !banned.has(alt)) return alt;
  }
  return null;
}

/** Saca lo pesado/pliométrico de una sesión (reemplaza por alternativas livianas cuando hay). */
function lighten(s: PlanSession, lib: Record<string, ExerciseInfo>, opts: { heavy: boolean; plyo: boolean }): PlanSession {
  const used = new Set(s.exercises.map((e) => e.exerciseId));
  const out: PlanSession["exercises"] = [];
  for (const e of s.exercises) {
    const info = lib[e.exerciseId];
    const isHeavy = Boolean(info?.heavy_lower);
    const isPlyo = info?.pattern === "plyometric";
    if ((opts.heavy && isHeavy) || (opts.plyo && isPlyo)) {
      const alt = isPlyo ? null : lightAlternative(e.exerciseId, lib, used);
      if (alt) {
        used.add(alt);
        out.push({ ...e, exerciseId: alt, rir: Math.max(e.rir ?? 2, 3), notes: "Versión liviana por cercanía al partido." });
      }
      continue;
    }
    out.push(e);
  }
  return { ...s, exercises: out };
}

export function fixPlan(
  input: WeekPlan,
  ctx: PlacementContext,
  lib: Record<string, ExerciseInfo>,
): { plan: WeekPlan; changes: string[] } {
  const plan = clone(input);
  const changes: string[] = [];
  const restricted = (d: number) => dayRestriction(d, ctx) !== null;

  // 1) días inválidos o repetidos → mover a un día de gym libre, o sacar
  const used = new Set<number>();
  const valid: PlanSession[] = [];
  const homeless: PlanSession[] = [];
  for (const s of plan.sessions) {
    if (ctx.gymDays.includes(s.weekday) && !used.has(s.weekday)) {
      used.add(s.weekday);
      valid.push(s);
    } else homeless.push(s);
  }
  for (const s of homeless) {
    const free = ctx.gymDays.find((d) => !used.has(d));
    if (free !== undefined) {
      used.add(free);
      valid.push({ ...s, weekday: free });
      changes.push(`"${s.name}" pasó a otro día de gym.`);
    } else changes.push(`Saqué "${s.name}": no había día de gym disponible.`);
  }
  plan.sessions = valid.sort((a, b) => a.weekday - b.weekday);

  // 2) días seguidos (D5)
  if (!ctx.allowConsecutive) {
    let guard = 0;
    while (guard++ < 10) {
      const days = plan.sessions.map((s) => s.weekday);
      const clash = plan.sessions.find((s) => days.some((d) => cyclicDistance(d, s.weekday) === 1));
      if (!clash) break;
      const others = plan.sessions.filter((s) => s !== clash).map((s) => s.weekday);
      const free = ctx.gymDays.find(
        (d) => !others.includes(d) && d !== clash.weekday && !others.some((o) => cyclicDistance(o, d) === 1 || cyclicDistance(d, o) === 1),
      );
      if (free !== undefined) {
        changes.push(`Moví "${clash.name}" para dejar un día de descanso entre sesiones.`);
        clash.weekday = free;
      } else {
        changes.push(`Saqué "${clash.name}" para no entrenar días seguidos.`);
        plan.sessions = plan.sessions.filter((s) => s !== clash);
      }
    }
    plan.sessions.sort((a, b) => a.weekday - b.weekday);
  }

  // 3) intercambiar sesiones pesadas en días restringidos con livianas en días libres
  for (const s of plan.sessions) {
    const f = sessionFlags(s, lib);
    if (!restricted(s.weekday) || (!f.heavyLower && !f.plyo)) continue;
    const swap = plan.sessions.find((o) => o !== s && !restricted(o.weekday) && !sessionFlags(o, lib).heavyLower && !sessionFlags(o, lib).plyo);
    if (swap) {
      const d = s.weekday;
      s.weekday = swap.weekday;
      swap.weekday = d;
      changes.push(`Cambié "${s.name}" de día para alejarla del partido.`);
    }
  }
  plan.sessions.sort((a, b) => a.weekday - b.weekday);

  // 4) lo que siga en día restringido se aliviana
  plan.sessions = plan.sessions.map((s) => {
    const f = sessionFlags(s, lib);
    if (restricted(s.weekday) && (f.heavyLower || f.plyo)) {
      changes.push(`Aliviané "${s.name}" por estar pegada a un partido.`);
      return lighten(s, lib, { heavy: true, plyo: true });
    }
    return s;
  });

  // 5) máximo 2 de pierna pesada: conservan las más lejanas al partido
  const heavy = plan.sessions.filter((s) => sessionFlags(s, lib).heavyLower);
  if (heavy.length > MAX_HEAVY_LOWER_PER_WEEK) {
    const keep = new Set([...heavy].sort((a, b) => matchDistance(b.weekday, ctx) - matchDistance(a.weekday, ctx)).slice(0, MAX_HEAVY_LOWER_PER_WEEK));
    plan.sessions = plan.sessions.map((s) => {
      if (heavy.includes(s) && !keep.has(s)) {
        changes.push(`"${s.name}" pasa a pierna liviana: ya hay 2 sesiones pesadas.`);
        return lighten(s, lib, { heavy: true, plyo: false });
      }
      return s;
    });
  }

  // 6) presupuesto pliométrico
  const budget = plyoBudget(ctx.events);
  const plyo = plan.sessions.filter((s) => sessionFlags(s, lib).plyo);
  if (plyo.length > budget.maxSessions) {
    const keep = new Set([...plyo].sort((a, b) => matchDistance(b.weekday, ctx) - matchDistance(a.weekday, ctx)).slice(0, budget.maxSessions));
    plan.sessions = plan.sessions.map((s) => (plyo.includes(s) && !keep.has(s) ? lighten(s, lib, { heavy: false, plyo: true }) : s));
    changes.push("Bajé la cantidad de sesiones con saltos: tu deporte ya suma muchos.");
  }
  for (const s of plan.sessions) {
    let guard = 0;
    while (sessionFlags(s, lib).plyoSets > budget.maxSetsPerSession && guard++ < 50) {
      const plyoEx = s.exercises.filter((e) => lib[e.exerciseId]?.pattern === "plyometric");
      const biggest = plyoEx.sort((a, b) => b.sets - a.sets)[0];
      if (biggest.sets > 2) biggest.sets -= 1;
      else s.exercises = s.exercises.filter((e) => e !== plyoEx[plyoEx.length - 1]);
    }
  }

  plan.sessions = plan.sessions.filter((s) => s.exercises.length > 0);
  return { plan, changes: [...new Set(changes)] };
}
