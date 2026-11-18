import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { asUser, createDb, createUser, U } from "./setup";

let db: PGlite;
type Quota = { user_day: number; user_month: number; global_day: number; daily_cap: number | null; monthly_cap: number | null };
const consume = (uid: string) =>
  asUser(db, uid, async (tx) => (await tx.query<{ q: Quota }>("select public.consume_ai_quota() as q")).rows[0].q);

beforeEach(async () => {
  db = await createDb();
  await createUser(db, U.toto);
  await createUser(db, U.amigo);
});

describe("topes de IA", () => {
  it("cuenta por usuario y global", async () => {
    await consume(U.toto);
    await consume(U.toto);
    const q = await consume(U.amigo);
    expect(q.user_day).toBe(1);
    expect(q.global_day).toBe(3);
    const t = await consume(U.toto);
    expect(t.user_day).toBe(3);
    expect(t.user_month).toBe(3);
    expect(t.daily_cap).toBeNull();
  });

  it("devuelve la excepción del usuario cargada desde el SQL Editor", async () => {
    await db.query("insert into public.ai_limits (user_id, daily_cap, monthly_cap) values ($1, 60, 1000)", [U.toto]);
    const q = await consume(U.toto);
    expect(q.daily_cap).toBe(60);
    expect(q.monthly_cap).toBe(1000);
  });

  it("un usuario no puede darse más cupo ni resetear su contador", async () => {
    await expect(asUser(db, U.toto, (tx) => tx.query("insert into public.ai_limits (user_id, daily_cap) values ($1, 9999)", [U.toto]))).rejects.toThrow();
    await consume(U.toto);
    await expect(asUser(db, U.toto, (tx) => tx.query("update public.ai_usage set calls = 0 where user_id = $1", [U.toto]))).rejects.toThrow();
    await expect(asUser(db, U.toto, (tx) => tx.query("delete from public.ai_usage where user_id = $1", [U.toto]))).rejects.toThrow();
  });

  it("cada uno ve solo su uso", async () => {
    await consume(U.toto);
    const n = await asUser(db, U.amigo, async (tx) => (await tx.query<{ n: number }>("select count(*)::int n from public.ai_usage")).rows[0].n);
    expect(n).toBe(0);
  });

  it("el service role (crons) cuenta a nombre del usuario indicado", async () => {
    const q = await db.transaction(async (tx) => {
      await tx.exec("set local role service_role");
      return (await tx.query<{ q: Quota }>("select public.consume_ai_quota($1) as q", [U.amigo])).rows[0].q;
    });
    expect(q.user_day).toBe(1);
  });
});
