import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { asUser, createDb, createUser, U } from "./setup";

let db: PGlite;

async function seedToto() {
  await asUser(db, U.toto, async (tx) => {
    await tx.query("insert into public.weight_logs (log_date, kg) values ('2026-11-18', 84.5)");
    await tx.query("insert into public.food_logs (id, log_date, meal) values ('10000000-0000-4000-8000-000000000001', '2026-11-18', 'lunch')");
    await tx.query(
      "insert into public.food_log_items (food_log_id, name, grams, kcal, source) values ('10000000-0000-4000-8000-000000000001', 'Empanada', 90, 280, 'local')",
    );
    await tx.query("insert into public.workout_sessions (log_date, duration_min) values ('2026-11-18', 60)");
    await tx.query("insert into public.fitness_tests (log_date, test, value, unit) values ('2026-11-18', 'cmj', 52, 'cm')");
    await tx.query(
      "insert into public.user_goals (goal, pace, lifestyle, targets) values ('lose_fat', 'moderate', 'mixed', '{}'::jsonb)",
    );
    await tx.query("update public.profile_details set birthdate = '2003-05-01', sex = 'male' where user_id = $1", [U.toto]);
  });
}

const count = async (uid: string, table: string, where = "true") =>
  asUser(db, uid, async (tx) => {
    const r = await tx.query<{ n: number }>(`select count(*)::int as n from public.${table} where ${where}`);
    return r.rows[0].n;
  });

beforeEach(async () => {
  db = await createDb();
  await createUser(db, U.toto, "Toto");
  await createUser(db, U.amigo, "Amigo");
  await createUser(db, U.extra, "Extra");
  await seedToto();
});

describe("datos sólo del dueño", () => {
  it("otro usuario no ve detalles, objetivos ni preferencias", async () => {
    for (const t of ["profile_details", "user_goals", "diet_preferences", "gym_preferences", "privacy_settings", "notification_prefs"]) {
      expect(await count(U.amigo, t, `user_id = '${U.toto}'`), t).toBe(0);
      expect(await count(U.toto, t, `user_id = '${U.toto}'`), t).toBe(1);
    }
  });

  it("no se puede escribir a nombre de otro", async () => {
    await expect(
      asUser(db, U.amigo, (tx) =>
        tx.query("insert into public.weight_logs (user_id, log_date, kg) values ($1, '2026-11-19', 50)", [U.toto]),
      ),
    ).rejects.toThrow();
  });

  it("no se puede colgar un ítem en la comida de otro", async () => {
    await expect(
      asUser(db, U.amigo, (tx) =>
        tx.query(
          "insert into public.food_log_items (food_log_id, name, grams, kcal, source) values ('10000000-0000-4000-8000-000000000001', 'Troll', 1, 1, 'custom')",
        ),
      ),
    ).rejects.toThrow();
  });

  it("no se puede editar el perfil de otro", async () => {
    await asUser(db, U.amigo, (tx) => tx.query("update public.profiles set bio = 'hackeado' where id = $1", [U.toto]));
    const r = await db.query<{ bio: string }>("select bio from public.profiles where id = $1", [U.toto]);
    expect(r.rows[0].bio).toBe("");
  });
});

describe("cuenta pública", () => {
  it("sin seguir: ve entrenos y tests (visibles por defecto), no ve peso ni comidas", async () => {
    expect(await count(U.amigo, "workout_sessions")).toBe(1);
    expect(await count(U.amigo, "fitness_tests")).toBe(1);
    expect(await count(U.amigo, "weight_logs")).toBe(0);
    expect(await count(U.amigo, "food_logs")).toBe(0);
    expect(await count(U.amigo, "food_log_items")).toBe(0);
  });

  it("seguir una cuenta pública se acepta solo", async () => {
    await asUser(db, U.amigo, (tx) => tx.query("insert into public.follows (follower_id, following_id) values ($1, $2)", [U.amigo, U.toto]));
    const r = await db.query<{ status: string }>("select status from public.follows");
    expect(r.rows[0].status).toBe("accepted");
  });

  it("ocultar entrenos lo oculta en la base", async () => {
    await asUser(db, U.toto, (tx) => tx.query("update public.privacy_settings set show_training = false"));
    expect(await count(U.amigo, "workout_sessions")).toBe(0);
    expect(await count(U.toto, "workout_sessions")).toBe(1);
  });

  it("mostrar peso lo muestra", async () => {
    await asUser(db, U.toto, (tx) => tx.query("update public.privacy_settings set show_body = true"));
    expect(await count(U.amigo, "weight_logs")).toBe(1);
  });

  it("visible_sections refleja la configuración", async () => {
    const r = await asUser(db, U.amigo, (tx) => tx.query<{ s: string[] }>("select public.visible_sections($1) as s", [U.toto]));
    expect(r.rows[0].s.sort()).toEqual(["streaks", "tests", "training"]);
  });
});

describe("cuenta privada", () => {
  beforeEach(async () => {
    await asUser(db, U.toto, (tx) => tx.query("update public.profiles set is_private = true where id = $1", [U.toto]));
  });

  it("sin seguir no ve nada", async () => {
    expect(await count(U.amigo, "workout_sessions")).toBe(0);
    expect(await count(U.amigo, "fitness_tests")).toBe(0);
  });

  it("la solicitud queda pendiente aunque el cliente mande 'accepted'", async () => {
    await asUser(db, U.amigo, (tx) =>
      tx.query("insert into public.follows (follower_id, following_id, status) values ($1, $2, 'accepted')", [U.amigo, U.toto]),
    );
    const r = await db.query<{ status: string }>("select status from public.follows");
    expect(r.rows[0].status).toBe("pending");
    expect(await count(U.amigo, "workout_sessions")).toBe(0);
  });

  it("el que pide no puede autoaceptarse", async () => {
    await asUser(db, U.amigo, (tx) => tx.query("insert into public.follows (follower_id, following_id) values ($1, $2)", [U.amigo, U.toto]));
    await asUser(db, U.amigo, (tx) => tx.query("update public.follows set status = 'accepted' where following_id = $1", [U.toto]));
    const r = await db.query<{ status: string }>("select status from public.follows");
    expect(r.rows[0].status).toBe("pending");
  });

  it("aceptado: ve entrenos pero NO el peso (criterio H4)", async () => {
    await asUser(db, U.amigo, (tx) => tx.query("insert into public.follows (follower_id, following_id) values ($1, $2)", [U.amigo, U.toto]));
    await asUser(db, U.toto, (tx) => tx.query("update public.follows set status = 'accepted' where follower_id = $1", [U.amigo]));
    expect(await count(U.amigo, "workout_sessions")).toBe(1);
    expect(await count(U.amigo, "weight_logs")).toBe(0);
    expect(await count(U.amigo, "food_logs")).toBe(0);
    // un tercero sigue sin ver
    expect(await count(U.extra, "workout_sessions")).toBe(0);
  });

  it("pasar a pública acepta las pendientes", async () => {
    await asUser(db, U.amigo, (tx) => tx.query("insert into public.follows (follower_id, following_id) values ($1, $2)", [U.amigo, U.toto]));
    await asUser(db, U.toto, (tx) => tx.query("update public.profiles set is_private = false where id = $1", [U.toto]));
    const r = await db.query<{ status: string }>("select status from public.follows");
    expect(r.rows[0].status).toBe("accepted");
  });
});

describe("bloqueos", () => {
  it("bloquear corta el follow y oculta el perfil y las secciones", async () => {
    await asUser(db, U.amigo, (tx) => tx.query("insert into public.follows (follower_id, following_id) values ($1, $2)", [U.amigo, U.toto]));
    await asUser(db, U.toto, (tx) => tx.query("insert into public.blocks (blocker_id, blocked_id) values ($1, $2)", [U.toto, U.amigo]));
    expect((await db.query("select * from public.follows")).rows).toHaveLength(0);
    expect(await count(U.amigo, "profiles", `id = '${U.toto}'`)).toBe(0);
    expect(await count(U.amigo, "workout_sessions")).toBe(0);
    expect(await count(U.extra, "profiles", `id = '${U.toto}'`)).toBe(1);
  });

  it("el bloqueado no puede volver a seguir", async () => {
    await asUser(db, U.toto, (tx) => tx.query("insert into public.blocks (blocker_id, blocked_id) values ($1, $2)", [U.toto, U.amigo]));
    await expect(
      asUser(db, U.amigo, (tx) => tx.query("insert into public.follows (follower_id, following_id) values ($1, $2)", [U.amigo, U.toto])),
    ).rejects.toThrow();
  });

  it("nadie ve la lista de bloqueos de otro", async () => {
    await asUser(db, U.toto, (tx) => tx.query("insert into public.blocks (blocker_id, blocked_id) values ($1, $2)", [U.toto, U.amigo]));
    expect(await count(U.amigo, "blocks")).toBe(0);
    expect(await count(U.extra, "blocks")).toBe(0);
  });
});

describe("alimentos", () => {
  it("los alimentos propios no se ven entre usuarios; la base común sí", async () => {
    await asUser(db, U.toto, (tx) =>
      tx.query("insert into public.foods (name, source, kcal, created_by) values ('Receta secreta de la abuela', 'custom', 200, $1)", [U.toto]),
    );
    await db.query("insert into public.foods (name, source, kcal) values ('Banana', 'local', 89)");
    expect(await count(U.toto, "foods", "source = 'custom'")).toBe(1);
    expect(await count(U.amigo, "foods", "source = 'custom'")).toBe(0);
    expect(await count(U.amigo, "foods", "source = 'local'")).toBe(1);
  });

  it("nadie puede crear alimentos 'local' ni marcarlos verificados", async () => {
    await expect(asUser(db, U.amigo, (tx) => tx.query("insert into public.foods (name, source, kcal, created_by) values ('Fake', 'local', 1, $1)", [U.amigo]))).rejects.toThrow();
    await expect(
      asUser(db, U.amigo, (tx) => tx.query("insert into public.foods (name, source, kcal, created_by, verified) values ('Fake', 'off', 1, $1, true)", [U.amigo])),
    ).rejects.toThrow();
  });
});
