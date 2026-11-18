"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/data/me";
import { getAI } from "@/lib/ai/provider";
import { runAI } from "@/lib/ai/run";
import { aiFoodParseSchema } from "@/lib/ai/schemas/food";
import { FOOD_PARSE_SYSTEM, FOOD_PHOTO_PROMPT, foodParsePrompt } from "@/lib/ai/prompts/food";
import { draftsFromAI, draftsFromText } from "@/lib/food/draft";
import { recentAndFrequent, searchExternal, searchLocal } from "@/lib/food/search";
import type { DraftItem, FoodRow } from "@/lib/food/types";
import { feedbackAfterLog } from "@/lib/agent/feedback";

type Fail = { ok: false; error: string };

export async function searchFoodsAction(q: string, external = false): Promise<{ ok: true; foods: FoodRow[] } | Fail> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Se cortó la sesión" };
  const query = q.trim().slice(0, 80);
  if (query.length < 2) return { ok: true, foods: [] };
  const supabase = await createClient();
  const local = await searchLocal(supabase, query);
  if (!external) return { ok: true, foods: local };
  const ext = await searchExternal(supabase, userId, query);
  const seen = new Set(local.map((f) => f.id));
  return { ok: true, foods: [...local, ...ext.filter((f) => !seen.has(f.id))] };
}

export async function foodShortcutsAction(): Promise<{ recent: FoodRow[]; frequent: FoodRow[] }> {
  const userId = await getUserId();
  if (!userId) return { recent: [], frequent: [] };
  const supabase = await createClient();
  return recentAndFrequent(supabase, userId);
}

export async function analyzeFoodTextAction(
  text: string,
): Promise<{ ok: true; items: DraftItem[]; source: "ai" | "fallback"; missing: string[] } | Fail> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Se cortó la sesión" };
  const input = text.trim().slice(0, 500);
  if (input.length < 2) return { ok: false, error: "Contame qué comiste" };
  const supabase = await createClient();
  const ai = getAI();
  const out = await runAI({
    supabase,
    call: async () => {
      const parsed = await ai.generateJSON({ system: FOOD_PARSE_SYSTEM, prompt: foodParsePrompt(input), schema: aiFoodParseSchema, temperature: 0.2, thinking: "low", timeoutMs: 25_000, retries: 1 });
      return { items: await draftsFromAI(supabase, parsed.items), missing: [] as string[] };
    },
    fallback: () => draftsFromText(supabase, input),
  });
  return { ok: true, items: out.data.items, missing: out.data.missing, source: out.source };
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export async function analyzeFoodPhotoAction(
  form: FormData,
): Promise<{ ok: true; items: DraftItem[]; source: "ai" | "fallback"; photoPath: string | null } | Fail> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Se cortó la sesión" };
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No llegó la foto" };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: "La foto es muy pesada (máx. 5 MB)" };
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return { ok: false, error: "Formato no soportado" };

  const supabase = await createClient();
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from("food-photos").upload(path, bytes, { contentType: file.type, upsert: false });
  const photoPath = up.error ? null : path;

  const ai = getAI();
  const out = await runAI({
    supabase,
    call: async () => {
      const parsed = await ai.analyzeImage({
        system: FOOD_PARSE_SYSTEM,
        prompt: FOOD_PHOTO_PROMPT,
        schema: aiFoodParseSchema,
        image: { mimeType: file.type, data: bytes.toString("base64") },
      });
      return draftsFromAI(supabase, parsed.items);
    },
    fallback: () => [] as DraftItem[],
  });
  return { ok: true, items: out.data, source: out.source, photoPath };
}

const itemSchema = z.object({
  foodId: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(120),
  grams: z.number().positive().max(5000),
  kcal: z.number().min(0).max(10000),
  protein_g: z.number().min(0).max(1000),
  carbs_g: z.number().min(0).max(1000),
  fat_g: z.number().min(0).max(1000),
  source: z.enum(["local", "off", "usda", "custom", "ai_estimate"]),
  confidence: z.number().min(0).max(1).nullable(),
});

const saveSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meal: z.enum(["breakfast", "lunch", "snack", "dinner", "extra"]),
  origin: z.enum(["text", "photo", "search", "suggestion", "quick"]),
  inputText: z.string().max(500).nullable(),
  photoPath: z.string().max(300).nullable(),
  items: z.array(itemSchema).min(1, "Agregá al menos un alimento").max(30),
});

export async function saveFoodLogAction(input: z.infer<typeof saveSchema>): Promise<{ ok: true; feedback: string | null } | Fail> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Se cortó la sesión" };
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;
  if (d.photoPath && !d.photoPath.startsWith(`${userId}/`)) return { ok: false, error: "Foto inválida" };
  const supabase = await createClient();
  const log = await supabase
    .from("food_logs")
    .insert({ user_id: userId, log_date: d.date, meal: d.meal, origin: d.origin, input_text: d.inputText, photo_path: d.photoPath })
    .select("id")
    .single();
  if (log.error || !log.data) return { ok: false, error: "No pudimos guardar la comida" };
  const items = await supabase.from("food_log_items").insert(
    d.items.map((it) => ({
      food_log_id: log.data.id,
      user_id: userId,
      food_id: it.foodId,
      name: it.name,
      grams: it.grams,
      kcal: Math.round(it.kcal),
      protein_g: it.protein_g,
      carbs_g: it.carbs_g,
      fat_g: it.fat_g,
      source: it.source,
      confidence: it.confidence,
    })),
  );
  if (items.error) {
    await supabase.from("food_logs").delete().eq("id", log.data.id);
    return { ok: false, error: "No pudimos guardar los alimentos" };
  }
  revalidatePath("/", "layout");
  const feedback = await feedbackAfterLog(supabase, userId, { kind: "food", date: d.date, ref: log.data.id });
  return { ok: true, feedback };
}

export async function deleteFoodLogAction(id: string): Promise<{ ok: boolean }> {
  const userId = await getUserId();
  if (!userId) return { ok: false };
  const supabase = await createClient();
  const log = await supabase.from("food_logs").select("photo_path").eq("id", id).eq("user_id", userId).maybeSingle();
  const r = await supabase.from("food_logs").delete().eq("id", id).eq("user_id", userId);
  if (!r.error && log.data?.photo_path) await supabase.storage.from("food-photos").remove([log.data.photo_path]);
  revalidatePath("/", "layout");
  return { ok: !r.error };
}

export async function createCustomFoodAction(input: {
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  portionGrams?: number;
}): Promise<{ ok: true; food: FoodRow } | Fail> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Se cortó la sesión" };
  const s = z
    .object({
      name: z.string().trim().min(2).max(80),
      kcal: z.number().min(0).max(900),
      protein_g: z.number().min(0).max(100),
      carbs_g: z.number().min(0).max(100),
      fat_g: z.number().min(0).max(100),
      portionGrams: z.number().positive().max(2000).optional(),
    })
    .safeParse(input);
  if (!s.success) return { ok: false, error: "Revisá los valores (son por 100 g)" };
  const supabase = await createClient();
  const portions = [...(s.data.portionGrams ? [{ label: `1 porción (${s.data.portionGrams} g)`, grams: s.data.portionGrams }] : []), { label: "100 g", grams: 100 }];
  const r = await supabase
    .from("foods")
    .insert({ name: s.data.name, source: "custom", kcal: s.data.kcal, protein_g: s.data.protein_g, carbs_g: s.data.carbs_g, fat_g: s.data.fat_g, portions, created_by: userId })
    .select("*")
    .single();
  if (r.error || !r.data) return { ok: false, error: "No pudimos crear el alimento" };
  const { toFoodRow } = await import("@/lib/food/search");
  return { ok: true, food: toFoodRow(r.data) };
}
