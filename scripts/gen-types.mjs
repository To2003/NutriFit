// Genera lib/supabase/database.types.ts a partir de las migraciones (cargadas en PGlite),
// con el mismo formato que `supabase gen types typescript`.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = new URL("..", import.meta.url).pathname;
const db = new PGlite();
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
`);
const dir = join(root, "supabase/migrations");
for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  const sql = readFileSync(join(dir, f), "utf8");
  if (!sql.includes("@pglite-skip")) await db.exec(sql);
}

const tsType = (udt, dataType) => {
  const base = udt.replace(/^_/, "");
  let t;
  if (["int2", "int4", "int8", "numeric", "float4", "float8"].includes(base)) t = "number";
  else if (base === "bool") t = "boolean";
  else if (["json", "jsonb"].includes(base)) t = "Json";
  else t = "string";
  return dataType === "ARRAY" ? `${t}[]` : t;
};

const cols = (
  await db.query(`
  select c.table_name, c.column_name, c.is_nullable, c.column_default, c.udt_name, c.data_type,
         c.is_identity, c.is_generated, c.ordinal_position
  from information_schema.columns c
  join information_schema.tables t on t.table_name = c.table_name and t.table_schema = c.table_schema
  where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
  order by c.table_name, c.ordinal_position`)
).rows;

const fks = (
  await db.query(`
  select con.conname, cl.relname as table_name, rcl.relname as ref_table,
    (select array_agg(a.attname order by k.ord) from unnest(con.conkey) with ordinality k(attnum, ord)
       join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum) as cols,
    (select array_agg(a.attname order by k.ord) from unnest(con.confkey) with ordinality k(attnum, ord)
       join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum) as ref_cols
  from pg_constraint con
  join pg_class cl on cl.oid = con.conrelid
  join pg_namespace n on n.oid = cl.relnamespace
  join pg_class rcl on rcl.oid = con.confrelid
  join pg_namespace rn on rn.oid = rcl.relnamespace
  where con.contype = 'f' and n.nspname = 'public' and rn.nspname = 'public'
  order by cl.relname, con.conname`)
).rows;

const uniques = new Set(
  (
    await db.query(`
    select cl.relname as t, (select array_agg(a.attname order by a.attname) from pg_attribute a
      where a.attrelid = con.conrelid and a.attnum = any(con.conkey)) as cols
    from pg_constraint con join pg_class cl on cl.oid = con.conrelid join pg_namespace n on n.oid = cl.relnamespace
    where con.contype in ('p','u') and n.nspname = 'public'`)
  ).rows.map((r) => `${r.t}:${[...r.cols].sort().join(",")}`),
);

const fns = (
  await db.query(`
  select p.proname, pg_get_function_arguments(p.oid) as args, t.typname as ret, p.proretset
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type t on t.oid = p.prorettype
  where n.nspname = 'public' order by p.proname`)
).rows;

const tables = {};
for (const c of cols) (tables[c.table_name] ??= []).push(c);

const q = (s) => JSON.stringify(s);
let out = `// ⚠️ Generado por \`pnpm db:types\` a partir de supabase/migrations. No editar a mano.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
`;
for (const [name, cs] of Object.entries(tables)) {
  const row = cs.map((c) => `          ${c.column_name}: ${tsType(c.udt_name, c.data_type)}${c.is_nullable === "YES" ? " | null" : ""};`);
  const ins = cs.map((c) => {
    if (c.is_generated === "ALWAYS") return `          ${c.column_name}?: never;`;
    const opt = c.is_nullable === "YES" || c.column_default !== null || c.is_identity === "YES";
    return `          ${c.column_name}${opt ? "?" : ""}: ${tsType(c.udt_name, c.data_type)}${c.is_nullable === "YES" ? " | null" : ""};`;
  });
  const upd = cs.map((c) =>
    c.is_generated === "ALWAYS"
      ? `          ${c.column_name}?: never;`
      : `          ${c.column_name}?: ${tsType(c.udt_name, c.data_type)}${c.is_nullable === "YES" ? " | null" : ""};`,
  );
  const rels = fks
    .filter((f) => f.table_name === name)
    .map(
      (f) => `          {
            foreignKeyName: ${q(f.conname)};
            columns: ${q(f.cols)};
            isOneToOne: ${uniques.has(`${name}:${[...f.cols].sort().join(",")}`)};
            referencedRelation: ${q(f.ref_table)};
            referencedColumns: ${q(f.ref_cols)};
          },`,
    );
  out += `      ${name}: {
        Row: {
${row.join("\n")}
        };
        Insert: {
${ins.join("\n")}
        };
        Update: {
${upd.join("\n")}
        };
        Relationships: [
${rels.join("\n")}
        ];
      };
`;
}
out += `    };
    Views: { [_ in never]: never };
    Functions: {
`;
for (const f of fns) {
  const args = f.args
    ? f.args.split(",").map((a) => {
        const m = a.trim().match(/^(\w+)\s+(\w+)(?:\s+DEFAULT.*)?$/i);
        const opt = /DEFAULT/i.test(a);
        const t = m ? tsType(m[2] === "boolean" ? "bool" : m[2] === "uuid" ? "uuid" : m[2], "") : "unknown";
        return `${m ? m[1] : "arg"}${opt ? "?" : ""}: ${t}`;
      })
    : [];
  const ret = f.ret === "_text" ? "string[]" : tsType(f.ret, "");
  out += `      ${f.proname}: { Args: { ${args.join("; ")} }; Returns: ${ret} };\n`;
}
out += `    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
`;
mkdirSync(join(root, "lib/supabase"), { recursive: true });
writeFileSync(join(root, "lib/supabase/database.types.ts"), out);
console.log(`OK: ${Object.keys(tables).length} tablas, ${fns.length} funciones → lib/supabase/database.types.ts`);
