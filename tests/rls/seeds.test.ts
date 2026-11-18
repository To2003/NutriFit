import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { asUser, createDb, createUser, U } from "./setup";

describe("seeds", () => {
  it("cargan sobre el esquema, son idempotentes y se pueden buscar", async () => {
    const db = await createDb();
    for (let i = 0; i < 2; i++)
      for (const f of ["exercises.sql", "foods_ar.sql", "achievements.sql"])
        await db.exec(readFileSync(join(process.cwd(), "supabase/seed", f), "utf8"));
    const ex = await db.query<{ n: number }>("select count(*)::int n from public.exercises");
    const fo = await db.query<{ n: number }>("select count(*)::int n from public.foods where source = 'local'");
    expect(ex.rows[0].n).toBeGreaterThanOrEqual(115);
    expect(fo.rows[0].n).toBeGreaterThanOrEqual(150);
    await createUser(db, U.toto);
    const r = await asUser(db, U.toto, (tx) => tx.query<{ name: string }>("select name from public.foods where search_name like '%empanada%'"));
    expect(r.rows.length).toBeGreaterThanOrEqual(5);
    const acc = await asUser(db, U.toto, (tx) => tx.query<{ name: string }>("select name from public.foods where search_name like '%jamon%'"));
    expect(acc.rows.length).toBeGreaterThan(0);
  });
});
