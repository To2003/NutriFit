"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/data/me";

type Res = { ok: true; status?: string } | { ok: false; error: string };
const uuid = z.string().uuid();

async function ctx() {
  const userId = await getUserId();
  if (!userId) return null;
  return { userId, supabase: await createClient() };
}

export async function followAction(targetId: string): Promise<Res> {
  const c = await ctx();
  if (!c || !uuid.safeParse(targetId).success) return { ok: false, error: "No se pudo" };
  // el estado (pendiente/aceptado) lo decide la base según la privacidad del perfil
  const r = await c.supabase.from("follows").insert({ follower_id: c.userId, following_id: targetId }).select("status").single();
  if (r.error) return { ok: false, error: r.error.code === "23505" ? "Ya lo seguís" : "No podés seguir a este perfil" };
  revalidatePath("/perfil", "layout");
  return { ok: true, status: r.data.status };
}

export async function unfollowAction(targetId: string): Promise<Res> {
  const c = await ctx();
  if (!c) return { ok: false, error: "No se pudo" };
  await c.supabase.from("follows").delete().eq("follower_id", c.userId).eq("following_id", targetId);
  revalidatePath("/perfil", "layout");
  return { ok: true };
}

export async function acceptRequestAction(followerId: string): Promise<Res> {
  const c = await ctx();
  if (!c) return { ok: false, error: "No se pudo" };
  const r = await c.supabase.from("follows").update({ status: "accepted" }).eq("follower_id", followerId).eq("following_id", c.userId);
  if (r.error) return { ok: false, error: "No se pudo aceptar" };
  revalidatePath("/perfil", "layout");
  return { ok: true };
}

/** Rechazar solicitud o eliminar un seguidor. */
export async function removeFollowerAction(followerId: string): Promise<Res> {
  const c = await ctx();
  if (!c) return { ok: false, error: "No se pudo" };
  await c.supabase.from("follows").delete().eq("follower_id", followerId).eq("following_id", c.userId);
  revalidatePath("/perfil", "layout");
  return { ok: true };
}

export async function blockAction(targetId: string): Promise<Res> {
  const c = await ctx();
  if (!c || targetId === c.userId) return { ok: false, error: "No se pudo" };
  const r = await c.supabase.from("blocks").insert({ blocker_id: c.userId, blocked_id: targetId });
  if (r.error && r.error.code !== "23505") return { ok: false, error: "No se pudo bloquear" };
  revalidatePath("/perfil", "layout");
  return { ok: true };
}

export async function unblockAction(targetId: string): Promise<Res> {
  const c = await ctx();
  if (!c) return { ok: false, error: "No se pudo" };
  await c.supabase.from("blocks").delete().eq("blocker_id", c.userId).eq("blocked_id", targetId);
  revalidatePath("/perfil", "layout");
  return { ok: true };
}

export async function searchUsersAction(q: string): Promise<{ id: string; username: string; display_name: string; avatar_url: string | null; is_private: boolean }[]> {
  const c = await ctx();
  if (!c) return [];
  const query = q.trim().replace(/[%_,()]/g, "").slice(0, 30);
  if (query.length < 2) return [];
  const { data } = await c.supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, is_private")
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .neq("id", c.userId)
    .not("username", "like", "user\\_%")
    .limit(20);
  return data ?? [];
}

const profileSchema = z.object({
  display_name: z.string().trim().min(1).max(40),
  bio: z.string().trim().max(280),
});

export async function updateProfileAction(input: z.infer<typeof profileSchema>): Promise<Res> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Se cortó la sesión" };
  const p = profileSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Revisá los datos" };
  const r = await c.supabase.from("profiles").update(p.data).eq("id", c.userId);
  if (r.error) return { ok: false, error: "No pudimos guardar" };
  revalidatePath("/perfil", "layout");
  return { ok: true };
}

export async function updateWaterSizesAction(input: { glass: number; bottle: number }): Promise<Res> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Se cortó la sesión" };
  const p = z.object({ glass: z.number().int().min(50).max(2000), bottle: z.number().int().min(100).max(3000) }).safeParse(input);
  if (!p.success) return { ok: false, error: "Revisá los tamaños" };
  await c.supabase.from("profile_details").update({ water_glass_ml: p.data.glass, water_bottle_ml: p.data.bottle }).eq("user_id", c.userId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function uploadAvatarAction(form: FormData): Promise<Res> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Se cortó la sesión" };
  const file = form.get("avatar");
  if (!(file instanceof File) || file.size === 0 || file.size > 2 * 1024 * 1024 || !["image/webp", "image/jpeg", "image/png"].includes(file.type)) return { ok: false, error: "Imagen inválida (máx. 2 MB)" };
  // Avatar como data URL chico (≤ 2 MB ya comprimido en el cliente a ~256 px); evita un bucket público.
  const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  if (b64.length > 200_000) return { ok: false, error: "La imagen es muy pesada" };
  await c.supabase.from("profiles").update({ avatar_url: `data:${file.type};base64,${b64}` }).eq("id", c.userId);
  revalidatePath("/perfil", "layout");
  return { ok: true };
}
