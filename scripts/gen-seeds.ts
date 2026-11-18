// Genera supabase/seed/*.sql desde los datos en TypeScript.
// Uso: pnpm db:seeds  (node --experimental-strip-types)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXERCISE_LIBRARY, EXERCISE_TEXT } from "../lib/training/library-data.ts";
import { FOODS_AR } from "../lib/food/foods-ar-data.ts";
import { ACHIEVEMENTS } from "../lib/gamification/achievements-data.ts";

const root = join(import.meta.dirname, "..");
const dir = join(root, "supabase/seed");
mkdirSync(dir, { recursive: true });

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const arr = (xs: string[]) => `array[${xs.map(q).join(", ")}]::text[]`;

// ── exercises.sql ──
const ex = EXERCISE_LIBRARY.map((e) => {
  const t = EXERCISE_TEXT[e.id];
  return `  (${[
    q(e.id), q(e.name), q(e.pattern), q(e.region), arr(e.muscles), arr(e.equipment), arr(e.focus), q(e.impact), q(e.level),
    e.unilateral, q(e.load_type), e.heavy_lower, arr(e.alternatives), q(t.instructions), q(t.mistakes),
  ].join(", ")})`;
});
writeFileSync(
  join(dir, "exercises.sql"),
  `-- NutriFit · biblioteca de ejercicios (${EXERCISE_LIBRARY.length}). Generado por \`pnpm db:seeds\`. Idempotente.
insert into public.exercises (id, name, pattern, region, muscles, equipment, focus, impact, level, unilateral, load_type, heavy_lower, alternatives, instructions, common_mistakes)
values
${ex.join(",\n")}
on conflict (id) do update set
  name = excluded.name, pattern = excluded.pattern, region = excluded.region, muscles = excluded.muscles,
  equipment = excluded.equipment, focus = excluded.focus, impact = excluded.impact, level = excluded.level,
  unilateral = excluded.unilateral, load_type = excluded.load_type, heavy_lower = excluded.heavy_lower,
  alternatives = excluded.alternatives, instructions = excluded.instructions, common_mistakes = excluded.common_mistakes;
`,
);

// ── foods_ar.sql ──
const foods = FOODS_AR.map(([name, aliases, kcal, p, c, f, fib, portions]) => {
  const por = JSON.stringify([...portions.map(([label, grams]) => ({ label, grams })), ...(portions.some(([, g]) => g === 100) ? [] : [{ label: "100 g", grams: 100 }])]);
  return `  (${[q(name), "'local'", kcal, p, c, f, fib, `${q(por)}::jsonb`, arr(aliases), "false"].join(", ")})`;
});
writeFileSync(
  join(dir, "foods_ar.sql"),
  `-- NutriFit · base local de alimentos argentinos (${FOODS_AR.length}). Valores por 100 g/ml. verified = false: revisar.
-- Generado por \`pnpm db:seeds\`. Idempotente.
insert into public.foods (name, source, kcal, protein_g, carbs_g, fat_g, fiber_g, portions, aliases, verified)
values
${foods.join(",\n")}
on conflict (name) where source = 'local' do update set
  kcal = excluded.kcal, protein_g = excluded.protein_g, carbs_g = excluded.carbs_g, fat_g = excluded.fat_g,
  fiber_g = excluded.fiber_g, portions = excluded.portions, aliases = excluded.aliases;
`,
);

// ── achievements.sql ──
const ach = ACHIEVEMENTS.map((a, i) => `  (${[q(a.code), q(a.name), q(a.description), q(a.emoji), i].join(", ")})`);
writeFileSync(
  join(dir, "achievements.sql"),
  `-- NutriFit · logros. Generado por \`pnpm db:seeds\`. Idempotente.
insert into public.achievements (code, name, description, emoji, sort)
values
${ach.join(",\n")}
on conflict (code) do update set name = excluded.name, description = excluded.description, emoji = excluded.emoji, sort = excluded.sort;
`,
);

console.log(`OK: ${EXERCISE_LIBRARY.length} ejercicios, ${FOODS_AR.length} alimentos, ${ACHIEVEMENTS.length} logros → supabase/seed/`);
