import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";

/** Stub mínimo de lo que Supabase provee: roles, schema auth y auth.uid(). */
const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
`;

export async function createDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = join(process.cwd(), "supabase/migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(dir, f), "utf8");
    if (sql.includes("@pglite-skip")) continue;
    try {
      await db.exec(sql);
    } catch (e) {
      throw new Error(`Falló la migración ${f}: ${(e as Error).message}`);
    }
  }
  return db;
}

export async function createUser(db: PGlite, id: string, name = "Test") {
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
    id,
    `${id.slice(0, 8)}@test.local`,
    JSON.stringify({ full_name: name }),
  ]);
}

/** Corre `fn` como el usuario `uid` (rol authenticated + JWT sub), dentro de una transacción. */
export async function asUser<T>(db: PGlite, uid: string, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
    return fn(tx);
  });
}

export const U = {
  toto: "00000000-0000-4000-8000-000000000001",
  amigo: "00000000-0000-4000-8000-000000000002",
  extra: "00000000-0000-4000-8000-000000000003",
};
