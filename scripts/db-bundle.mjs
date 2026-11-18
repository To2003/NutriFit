// Junta supabase/migrations/*.sql (en orden) + seeds en supabase/dist/all.sql
// para pegar de una en el SQL Editor de Supabase.
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const migDir = join(root, "supabase/migrations");
const seedDir = join(root, "supabase/seed");
const outDir = join(root, "supabase/dist");
mkdirSync(outDir, { recursive: true });

const files = readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
const seeds = existsSync(seedDir) ? readdirSync(seedDir).filter((f) => f.endsWith(".sql")).sort() : [];

const parts = [
  "-- NutriFit · bundle generado por `pnpm db:bundle`. No editar a mano.",
  `-- Generado: ${new Date().toISOString()}`,
  "",
];
for (const f of files) parts.push(`-- ═════ migrations/${f} ═════`, readFileSync(join(migDir, f), "utf8"), "");
writeFileSync(join(outDir, "migrations.sql"), parts.join("\n"));

const seedParts = ["-- NutriFit · seeds (correr después de migrations.sql)", ""];
for (const f of seeds) seedParts.push(`-- ═════ seed/${f} ═════`, readFileSync(join(seedDir, f), "utf8"), "");
writeFileSync(join(outDir, "seed.sql"), seedParts.join("\n"));

console.log(`OK: ${files.length} migraciones → supabase/dist/migrations.sql; ${seeds.length} seeds → supabase/dist/seed.sql`);
