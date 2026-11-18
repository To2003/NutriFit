/**
 * Modo demo (NEXT_PUBLIC_DEMO=1): un "Supabase" en memoria con la misma API de query builder
 * que usa la app (subset). Sirve para ver y probar todas las pantallas sin proyecto Supabase.
 * NO es seguro ni persistente: no hay RLS y los datos se pierden al reiniciar el server.
 */
import { normalize } from "@/lib/text";

type Row = Record<string, unknown>;
type Res = { data: unknown; error: { code: string; message: string } | null; count?: number | null };

interface DemoGlobal {
  tables: Record<string, Row[]>;
  seeded: Promise<void> | null;
}
const g = globalThis as unknown as { __nutrifitDemo?: DemoGlobal };
export const demo: DemoGlobal = (g.__nutrifitDemo ??= { tables: {}, seeded: null });

export const DEMO_USER = "00000000-0000-4000-8000-00000000d0d0";
export const DEMO_FRIEND = "00000000-0000-4000-8000-00000000f00d";

export const isDemo = () => process.env.NEXT_PUBLIC_DEMO === "1";

const t = (name: string) => (demo.tables[name] ??= []);
const uuid = () => crypto.randomUUID();

/** Tablas sin columna `id` (PK compuesta o por usuario). */
const NO_ID = new Set([
  "profile_details", "privacy_settings", "gym_preferences", "diet_preferences", "notification_prefs",
  "follows", "blocks", "user_streaks", "user_achievements", "ai_usage", "achievements", "exercises",
]);

/** Restricciones únicas relevantes para la app. */
const UNIQUE: Record<string, string[][]> = {
  profiles: [["id"]],
  follows: [["follower_id", "following_id"]],
  blocks: [["blocker_id", "blocked_id"]],
  weight_logs: [["user_id", "log_date"]],
  user_sports: [["user_id", "sport"]],
  user_achievements: [["user_id", "code"]],
  user_streaks: [["user_id", "kind"]],
  notification_log: [["user_id", "dedupe_key"]],
  push_subscriptions: [["endpoint"]],
  tdee_proposals: [["user_id", "week_start"]],
  profile_details: [["user_id"]],
  privacy_settings: [["user_id"]],
  gym_preferences: [["user_id"]],
  diet_preferences: [["user_id"]],
  notification_prefs: [["user_id"]],
  foods: [["source", "external_id"]],
};

function defaults(table: string, r: Row): Row {
  const now = new Date().toISOString();
  const out: Row = { created_at: now, ...r };
  if (!NO_ID.has(table) && out.id == null) out.id = uuid();
  switch (table) {
    case "workout_sessions":
      out.started_at ??= now;
      out.ended_at ??= null;
      out.notes ??= "";
      break;
    case "agent_messages":
      out.read_at ??= null;
      out.source ??= "ai";
      break;
    case "weekly_goals":
      out.done ??= false;
      out.evaluated ??= false;
      break;
    case "programs":
      out.status ??= "active";
      out.notes ??= "";
      out.weeks ??= 4;
      break;
    case "tdee_proposals":
      out.status ??= "pending";
      break;
    case "pain_reports":
      out.resolved ??= false;
      out.notes ??= "";
      break;
    case "water_logs":
      out.logged_at ??= now;
      break;
    case "activity_logs":
      out.status ??= "done";
      break;
    case "foods":
      out.portions ??= [];
      out.aliases ??= [];
      out.verified ??= false;
      out.search_name = normalize(`${out.name ?? ""} ${out.brand ?? ""}`);
      break;
    case "follows": {
      const target = t("profiles").find((p) => p.id === out.following_id);
      const priv = target ? Boolean(target.is_private) : true;
      out.status = priv ? "pending" : "accepted";
      out.accepted_at = priv ? null : now;
      break;
    }
  }
  return out;
}

const same = (a: unknown, b: unknown) => (a == null && b == null) || (a != null && b != null && String(a) === String(b));
const cmp = (a: unknown, b: unknown) => {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const na = Number(a);
  const nb = Number(b);
  if (a != null && b != null && !Number.isNaN(na) && !Number.isNaN(nb) && typeof a !== "string") return na - nb;
  return String(a ?? "").localeCompare(String(b ?? ""));
};
const esc = (ch: string) => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** LIKE de Postgres → RegExp (% = cualquier cosa, _ = un carácter, \ escapa). */
function likeRe(pattern: string, flags: string): RegExp {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "\\" && i + 1 < pattern.length) re += esc(pattern[++i]);
    else if (ch === "%") re += ".*";
    else if (ch === "_") re += ".";
    else re += esc(ch);
  }
  return new RegExp(`^${re}$`, flags);
}

// ── Relaciones para selects anidados ─────────────────────────────────────────
const REL: Record<string, { kind: "many" | "one"; fk: string; ref?: string }> = {
  "food_logs.food_log_items": { kind: "many", fk: "food_log_id" },
  "program_sessions.program_exercises": { kind: "many", fk: "session_id" },
  "programs.program_sessions": { kind: "many", fk: "program_id" },
  "workout_sessions.program_sessions": { kind: "one", fk: "program_session_id", ref: "id" },
  "user_achievements.achievements": { kind: "one", fk: "code", ref: "code" },
};

function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function embed(table: string, rows: Row[], select: string): Row[] {
  const parts = splitTop(select).filter((p) => p.includes("("));
  if (!parts.length) return rows.map((r) => ({ ...r }));
  return rows.map((r) => {
    const out: Row = { ...r };
    for (const p of parts) {
      const name = p.slice(0, p.indexOf("(")).trim();
      const inner = p.slice(p.indexOf("(") + 1, p.lastIndexOf(")"));
      const rel = REL[`${table}.${name}`];
      if (!rel) continue;
      if (rel.kind === "many") out[name] = embed(name, t(name).filter((c) => same(c[rel.fk], r.id)), inner);
      else {
        const hit = t(name).find((c) => same(c[rel.ref!], r[rel.fk]));
        out[name] = hit ? embed(name, [hit], inner)[0] : null;
      }
    }
    return out;
  });
}

type Op = "select" | "insert" | "update" | "delete" | "upsert";

class Query implements PromiseLike<Res> {
  private op: Op = "select";
  private filters: ((r: Row) => boolean)[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private lim: number | null = null;
  private mode: "one" | "maybe" | null = null;
  private cols = "*";
  private returning = false;
  private payload: Row[] = [];
  private patch: Row = {};
  private conflict: string[] = [];
  private ignoreDup = false;
  private head = false;
  private counting = false;

  constructor(private table: string) {}

  select(cols = "*", opts?: { count?: string; head?: boolean }) {
    if (this.op === "select") this.cols = cols;
    else this.returning = true;
    if (opts?.count) this.counting = true;
    if (opts?.head) this.head = true;
    return this;
  }
  insert(p: Row | Row[]) {
    this.op = "insert";
    this.payload = Array.isArray(p) ? p : [p];
    return this;
  }
  upsert(p: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.op = "upsert";
    this.payload = Array.isArray(p) ? p : [p];
    this.conflict = opts?.onConflict ? opts.onConflict.split(",").map((s) => s.trim()) : (UNIQUE[this.table]?.[0] ?? ["id"]);
    this.ignoreDup = Boolean(opts?.ignoreDuplicates);
    return this;
  }
  update(p: Row) {
    this.op = "update";
    this.patch = p;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(c: string, v: unknown) {
    this.filters.push((r) => same(r[c], v));
    return this;
  }
  neq(c: string, v: unknown) {
    this.filters.push((r) => !same(r[c], v));
    return this;
  }
  gt(c: string, v: unknown) {
    this.filters.push((r) => r[c] != null && cmp(r[c], v) > 0);
    return this;
  }
  gte(c: string, v: unknown) {
    this.filters.push((r) => r[c] != null && cmp(r[c], v) >= 0);
    return this;
  }
  lt(c: string, v: unknown) {
    this.filters.push((r) => r[c] != null && cmp(r[c], v) < 0);
    return this;
  }
  lte(c: string, v: unknown) {
    this.filters.push((r) => r[c] != null && cmp(r[c], v) <= 0);
    return this;
  }
  in(c: string, vs: unknown[]) {
    this.filters.push((r) => vs.some((v) => same(r[c], v)));
    return this;
  }
  is(c: string, v: unknown) {
    this.filters.push((r) => (v === null ? r[c] == null : same(r[c], v)));
    return this;
  }
  like(c: string, p: string) {
    this.filters.push((r) => likeRe(p, "").test(String(r[c] ?? "")));
    return this;
  }
  ilike(c: string, p: string) {
    this.filters.push((r) => likeRe(p, "i").test(String(r[c] ?? "")));
    return this;
  }
  not(c: string, op: string, v: unknown) {
    if (op === "is") this.filters.push((r) => !(v === null ? r[c] == null : same(r[c], v)));
    else if (op === "like") this.filters.push((r) => !likeRe(String(v), "").test(String(r[c] ?? "")));
    else if (op === "eq") this.filters.push((r) => !same(r[c], v));
    return this;
  }
  or(expr: string) {
    const conds = expr.split(",").map((part) => {
      const [col, op, ...rest] = part.split(".");
      const val = rest.join(".");
      return (r: Row) => (op === "ilike" ? likeRe(val, "i").test(String(r[col] ?? "")) : op === "eq" ? same(r[col], val) : false);
    });
    this.filters.push((r) => conds.some((f) => f(r)));
    return this;
  }
  order(c: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col: c, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.lim = n;
    return this;
  }
  single() {
    this.mode = "one";
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }

  private match(rows: Row[]) {
    return rows.filter((r) => this.filters.every((f) => f(r)));
  }

  private finish(rows: Row[]): Res {
    let out = [...rows];
    for (const o of [...this.orders].reverse()) out.sort((a, b) => (o.asc ? 1 : -1) * cmp(a[o.col], b[o.col]));
    const count = out.length;
    if (this.lim != null) out = out.slice(0, this.lim);
    out = embed(this.table, out, this.cols);
    if (this.head) return { data: null, error: null, count };
    if (this.mode === "one") return out.length === 1 ? { data: out[0], error: null } : { data: null, error: { code: "PGRST116", message: "not single" } };
    if (this.mode === "maybe") return { data: out[0] ?? null, error: null };
    return { data: out, error: null, count: this.counting ? count : null };
  }

  private violates(row: Row, ignore?: Row): boolean {
    return (UNIQUE[this.table] ?? []).some((cols) =>
      t(this.table).some((r) => r !== ignore && cols.every((c) => row[c] != null && same(r[c], row[c]))),
    );
  }

  private exec(): Res {
    const table = t(this.table);
    switch (this.op) {
      case "select":
        return this.finish(this.match(table));
      case "insert": {
        const rows = this.payload.map((p) => defaults(this.table, p));
        for (const r of rows) if (this.violates(r)) return { data: null, error: { code: "23505", message: "duplicate key" } };
        table.push(...rows);
        return this.returning ? this.finish(rows) : { data: null, error: null };
      }
      case "upsert": {
        const touched: Row[] = [];
        for (const p of this.payload) {
          const hit = table.find((r) => this.conflict.every((c) => p[c] != null && same(r[c], p[c])));
          if (hit) {
            if (!this.ignoreDup) {
              Object.assign(hit, p);
              touched.push(hit);
            }
          } else {
            const row = defaults(this.table, p);
            table.push(row);
            touched.push(row);
          }
        }
        return this.returning ? this.finish(touched) : { data: null, error: null };
      }
      case "update": {
        const rows = this.match(table);
        for (const r of rows) {
          if (this.table === "follows" && this.patch.status === "accepted" && r.status === "pending") this.patch.accepted_at = new Date().toISOString();
          Object.assign(r, this.patch);
          if (this.table === "profiles" && this.patch.is_private === false)
            for (const f of t("follows")) if (f.following_id === r.id && f.status === "pending") f.status = "accepted";
        }
        return this.returning ? this.finish(rows) : { data: null, error: null };
      }
      case "delete": {
        const rows = new Set(this.match(table));
        demo.tables[this.table] = table.filter((r) => !rows.has(r));
        if (this.table === "food_logs") demo.tables.food_log_items = t("food_log_items").filter((i) => ![...rows].some((r) => r.id === i.food_log_id));
        if (this.table === "workout_sessions") demo.tables.set_logs = t("set_logs").filter((i) => ![...rows].some((r) => r.id === i.workout_session_id));
        return { data: null, error: null };
      }
    }
  }

  then<A = Res, B = never>(ok?: ((v: Res) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    try {
      return Promise.resolve(this.exec()).then(ok, fail);
    } catch (e) {
      return Promise.reject(e).then(ok, fail);
    }
  }
}

export function createDemoClient() {
  return {
    from: (table: string) => new Query(table),
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      if (fn === "bump_ai_usage") return { data: 1, error: null };
      if (fn === "consume_ai_quota") return { data: null, error: null };
      if (fn === "visible_sections") {
        const owner = args?.owner as string;
        if (owner === DEMO_USER) return { data: ["streaks", "training", "tests", "meals", "body"], error: null };
        const pv = t("privacy_settings").find((p) => p.user_id === owner) ?? {};
        const map: [string, string][] = [["streaks", "show_streaks"], ["training", "show_training"], ["tests", "show_tests"], ["meals", "show_meals"], ["body", "show_body"]];
        return { data: map.filter(([, k]) => pv[k]).map(([s]) => s), error: null };
      }
      return { data: null, error: null };
    },
    auth: {
      getClaims: async () => ({ data: { claims: { sub: DEMO_USER } }, error: null }),
      getUser: async () => ({ data: { user: { id: DEMO_USER } }, error: null }),
      exchangeCodeForSession: async () => ({ data: { user: { id: DEMO_USER } }, error: null }),
      signOut: async () => ({ error: null }),
      signInWithOAuth: async () => ({ data: null, error: null }),
    },
    storage: {
      from: () => ({
        upload: async (path: string) => ({ data: { path }, error: null }),
        remove: async () => ({ data: null, error: null }),
      }),
    },
  };
}
