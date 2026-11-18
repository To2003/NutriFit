import { describe, expect, it } from "vitest";
import { createDb, createUser, U } from "./setup";

describe("migraciones", () => {
  it("corren en Postgres limpio y crean el perfil al primer login", async () => {
    const db = await createDb();
    await createUser(db, U.toto, "Toto");
    const r = await db.query<{ username: string; display_name: string }>("select username, display_name from public.profiles");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].display_name).toBe("Toto");
    expect(r.rows[0].username).toMatch(/^user_[0-9a-f]{12}$/);
    const priv = await db.query("select * from public.privacy_settings");
    expect(priv.rows).toHaveLength(1);
  });

  it("RLS habilitado en todas las tablas de public", async () => {
    const db = await createDb();
    const r = await db.query<{ relname: string }>(
      "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity",
    );
    expect(r.rows.map((x) => x.relname)).toEqual([]);
  });
});
