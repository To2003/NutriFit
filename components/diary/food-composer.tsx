"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Camera, Loader2, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Chip, Segmented } from "@/components/ui/choice";
import { MEALS, type Meal } from "@/lib/domain/catalog";
import { cn, fmt, fmt1, vibrate } from "@/lib/utils";
import { itemTotals, scaleEstimate, type DraftItem, type FoodRow } from "@/lib/food/types";
import {
  analyzeFoodPhotoAction,
  analyzeFoodTextAction,
  foodShortcutsAction,
  saveFoodLogAction,
  searchFoodsAction,
} from "@/app/actions/food";
import { defaultMealForHour, useActiveDate } from "@/components/app/app-context";
import { profeToast } from "./profe-toast";

type Tab = "text" | "photo" | "search";
type Origin = "text" | "photo" | "search";

const key = () => Math.random().toString(36).slice(2, 10);

function draftFromFoodClient(food: FoodRow): DraftItem {
  const portion = food.portions.find((p) => !/100 ?g/.test(p.label)) ?? food.portions[0] ?? { label: "100 g", grams: 100 };
  return {
    key: key(),
    foodId: food.id.startsWith("ext-") ? null : food.id,
    name: food.brand && food.source !== "local" ? `${food.name} (${food.brand})` : food.name,
    grams: portion.grams,
    per100: { kcal: food.kcal, protein_g: food.protein_g, carbs_g: food.carbs_g, fat_g: food.fat_g },
    totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    source: food.source,
    confidence: null,
    portions: food.portions.length ? food.portions : [{ label: "100 g", grams: 100 }],
  };
}

/** Achica la foto en el cliente (máx. 1280 px, JPEG 0,8) para ahorrar datos y Storage. */
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.8));
}

export function FoodComposer(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialMeal?: Meal;
  initialItems?: DraftItem[];
  origin?: "suggestion";
}) {
  // El cuerpo se monta de nuevo en cada apertura: el estado arranca limpio sin efectos de reseteo.
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange} title="Comida" className="h-[92dvh]">
      <ComposerBody initialMeal={props.initialMeal} initialItems={props.initialItems} origin={props.origin} onDone={() => props.onOpenChange(false)} />
    </Sheet>
  );
}

function ComposerBody({
  initialMeal,
  initialItems,
  origin: initialOrigin,
  onDone,
}: {
  initialMeal?: Meal;
  initialItems?: DraftItem[];
  origin?: "suggestion";
  onDone: () => void;
}) {
  const date = useActiveDate();
  const router = useRouter();
  const [meal, setMeal] = useState<Meal>(() => initialMeal ?? defaultMealForHour(new Date().getHours()));
  const [tab, setTab] = useState<Tab>("text");
  const [stage, setStage] = useState<"input" | "confirm">(initialItems?.length ? "confirm" : "input");
  const [items, setItems] = useState<DraftItem[]>(initialItems ?? []);
  const [origin, setOrigin] = useState<Origin | "suggestion">(initialOrigin ?? "search");
  const [text, setText] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const [saving, startSaving] = useTransition();

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, it) => {
          const t = itemTotals(it);
          return { kcal: acc.kcal + t.kcal, protein_g: acc.protein_g + t.protein_g, carbs_g: acc.carbs_g + t.carbs_g, fat_g: acc.fat_g + t.fat_g };
        },
        { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      ),
    [items],
  );

  const analyzeText = () =>
    startBusy(async () => {
      const r = await analyzeFoodTextAction(text);
      if (!r.ok) return void toast.error(r.error);
      setOrigin("text");
      setNote(
        r.missing.length
          ? `No encontré: ${r.missing.join(", ")}. Agregalo desde el buscador.`
          : r.source === "fallback"
            ? "El Profe está sin señal: lo armamos con la base local. Revisá las porciones."
            : null,
      );
      if (r.items.length === 0 && r.missing.length) {
        setTab("search");
        return;
      }
      setItems((cur) => [...cur, ...r.items]);
      setStage("confirm");
    });

  const analyzePhoto = (file: File) =>
    startBusy(async () => {
      const blob = await compressImage(file);
      setPhotoPreview(URL.createObjectURL(blob));
      const fd = new FormData();
      fd.set("photo", new File([blob], "plato.jpg", { type: blob.type || "image/jpeg" }));
      const r = await analyzeFoodPhotoAction(fd);
      if (!r.ok) return void toast.error(r.error);
      setOrigin("photo");
      setPhotoPath(r.photoPath);
      if (r.items.length === 0) {
        setNote("No pude reconocer el plato. Contámelo por texto o buscalo y lo cargamos igual.");
        setTab("text");
        return;
      }
      setNote("Estimado a ojo por la foto: revisá las porciones.");
      setItems((cur) => [...cur, ...r.items]);
      setStage("confirm");
    });

  const addFood = (food: FoodRow) => {
    vibrate(8);
    setItems((cur) => [...cur, draftFromFoodClient(food)]);
    if (origin !== "text" && origin !== "photo") setOrigin("search");
    setStage("confirm");
  };

  const save = () =>
    startSaving(async () => {
      const r = await saveFoodLogAction({
        date,
        meal,
        origin: origin === "suggestion" ? "suggestion" : origin,
        inputText: text || null,
        photoPath,
        items: items.map((it) => {
          const t = itemTotals(it);
          return {
            foodId: it.foodId,
            name: it.name,
            grams: it.grams,
            kcal: t.kcal,
            protein_g: t.protein_g,
            carbs_g: t.carbs_g,
            fat_g: t.fat_g,
            source: it.source,
            confidence: it.confidence,
          };
        }),
      });
      if (!r.ok) return void toast.error(r.error);
      vibrate([10, 40, 20]);
      onDone();
      profeToast(r.feedback, "Comida guardada 👌");
      router.refresh();
    });

  return (
      <div className="flex min-h-full flex-col pb-2">
        <p className="-mt-2 mb-2 text-sm text-muted">{stage === "confirm" ? "Revisá las porciones y guardá." : "¿Qué comiste?"}</p>
        <div className="-mx-5 mb-3 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
          {MEALS.map((m) => (
            <Chip key={m.value} selected={meal === m.value} onToggle={() => setMeal(m.value)} className="shrink-0">
              {m.emoji} {m.label}
            </Chip>
          ))}
        </div>

        {stage === "input" ? (
          <>
            <Segmented
              label="Forma de carga"
              value={tab}
              onChange={setTab}
              options={[
                { value: "text", label: "Escribir" },
                { value: "photo", label: "Foto" },
                { value: "search", label: "Buscar" },
              ]}
            />
            <div className="mt-4 flex-1">
              {note ? <p className="mb-3 rounded-[12px] bg-surface-2 p-3 text-sm text-muted">{note}</p> : null}
              {tab === "text" ? (
                <div className="space-y-3">
                  <Textarea
                    autoFocus
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Ej.: 2 empanadas de carne al horno y una coca chica"
                    maxLength={500}
                    aria-label="Qué comiste"
                  />
                  <Button block size="lg" disabled={busy || text.trim().length < 2} onClick={analyzeText}>
                    {busy ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
                    {busy ? "El Profe está mirando…" : "Analizar"}
                  </Button>
                </div>
              ) : tab === "photo" ? (
                <PhotoInput busy={busy} preview={photoPreview} onFile={analyzePhoto} />
              ) : (
                <FoodSearch onPick={addFood} />
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col">
            {note ? <p className="mb-3 rounded-[12px] bg-surface-2 p-3 text-sm text-muted">{note}</p> : null}
            <ul className="space-y-2.5">
              <AnimatePresence initial={false}>
                {items.map((it) => (
                  <motion.li key={it.key} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }}>
                    <DraftRow
                      item={it}
                      onChange={(n) => setItems((cur) => cur.map((x) => (x.key === it.key ? n : x)))}
                      onRemove={() => setItems((cur) => cur.filter((x) => x.key !== it.key))}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            <button
              type="button"
              onClick={() => {
                setStage("input");
                setTab("search");
              }}
              className="mt-3 flex h-12 items-center justify-center gap-2 rounded-[14px] border border-dashed border-line text-muted"
            >
              <Plus className="size-5" /> Agregar otro alimento
            </button>
            <div className="sticky bottom-0 mt-auto -mx-5 border-t border-line bg-surface px-5 pt-3">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="score text-[30px]">
                  {fmt(totals.kcal)} <span className="font-sans text-sm font-normal text-muted">kcal</span>
                </span>
                <span className="tnum text-sm text-muted">
                  P {fmt1(totals.protein_g)} · C {fmt1(totals.carbs_g)} · G {fmt1(totals.fat_g)}
                </span>
              </div>
              <Button block size="lg" disabled={saving || items.length === 0} onClick={save}>
                {saving ? "Guardando…" : "Guardar comida"}
              </Button>
            </div>
          </div>
        )}
      </div>
  );
}

function PhotoInput({ busy, preview, onFile }: { busy: boolean; preview: string | null; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-3">
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Sacar o elegir foto del plato"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => ref.current?.click()}
        className="relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-[18px] border border-dashed border-line bg-surface-2"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Foto del plato" className="absolute inset-0 size-full object-cover opacity-70" />
        ) : null}
        <span className="relative flex flex-col items-center gap-2 text-muted">
          {busy ? <Loader2 className="size-8 animate-spin text-accent" /> : <Camera className="size-8" />}
          <span className="font-semibold text-text">{busy ? "El Profe está mirando el plato…" : "Sacá una foto del plato"}</span>
          {!busy ? <span className="text-sm">Desde arriba y con buena luz</span> : null}
        </span>
      </button>
      <p className="text-xs text-muted">La foto se guarda en privado: solo la ves vos.</p>
    </div>
  );
}

function FoodSearch({ onPick }: { onPick: (f: FoodRow) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FoodRow[]>([]);
  const [shortcuts, setShortcuts] = useState<{ recent: FoodRow[]; frequent: FoodRow[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [extLoading, setExtLoading] = useState(false);
  const [searchedExternal, setSearchedExternal] = useState(false);

  useEffect(() => {
    foodShortcutsAction().then(setShortcuts).catch(() => {});
  }, []);

  const onQuery = (v: string) => {
    setQ(v);
    setSearchedExternal(false);
    if (v.trim().length < 2) setResults([]);
  };

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(async () => {
      setLoading(true);
      const r = await searchFoodsAction(q);
      setLoading(false);
      if (r.ok) setResults(r.foods);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const external = async () => {
    setExtLoading(true);
    const r = await searchFoodsAction(q, true);
    setExtLoading(false);
    setSearchedExternal(true);
    if (r.ok) setResults(r.foods);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted" />
        <Input autoFocus value={q} onChange={(e) => onQuery(e.target.value)} placeholder="Milanesa, banana, yogur…" className="pl-11" aria-label="Buscar alimento" />
      </div>
      {q.trim().length < 2 && shortcuts ? (
        <>
          {shortcuts.frequent.length ? <ShortcutRow title="Frecuentes" foods={shortcuts.frequent} onPick={onPick} /> : null}
          {shortcuts.recent.length ? <ShortcutRow title="Recientes" foods={shortcuts.recent} onPick={onPick} /> : null}
          {!shortcuts.frequent.length && !shortcuts.recent.length ? (
            <p className="text-sm text-muted">Lo que cargues seguido va a aparecer acá, a un toque.</p>
          ) : null}
        </>
      ) : null}
      {loading ? <p className="text-sm text-muted">Buscando…</p> : null}
      <ul className="divide-y divide-line">
        {results.map((f) => (
          <li key={f.id}>
            <button type="button" onClick={() => onPick(f)} className="flex w-full items-center gap-3 py-3 text-left active:bg-surface-2">
              <span className="flex-1">
                <span className="block font-medium">{f.name}</span>
                <span className="block text-xs text-muted">
                  {f.brand ? `${f.brand} · ` : ""}
                  {fmt(f.kcal)} kcal / 100 g · P {fmt1(f.protein_g)}
                </span>
              </span>
              <Plus className="size-5 text-accent" />
            </button>
          </li>
        ))}
      </ul>
      {q.trim().length >= 2 && !loading && !searchedExternal ? (
        <Button variant="secondary" block disabled={extLoading} onClick={external}>
          {extLoading ? "Buscando en otras bases…" : results.length ? "¿No está? Buscar en más bases" : "Buscar en Open Food Facts y USDA"}
        </Button>
      ) : null}
      {searchedExternal && results.length === 0 ? (
        <p className="text-sm text-muted">No lo encontramos. Probá describirlo en “Escribir” y el Profe lo estima.</p>
      ) : null}
    </div>
  );
}

function ShortcutRow({ title, foods, onPick }: { title: string; foods: FoodRow[]; onPick: (f: FoodRow) => void }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-muted">{title}</p>
      <div className="flex flex-wrap gap-2">
        {foods.map((f) => (
          <button key={f.id} type="button" onClick={() => onPick(f)} className="rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-sm active:scale-[0.97]">
            {f.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function DraftRow({ item, onChange, onRemove }: { item: DraftItem; onChange: (i: DraftItem) => void; onRemove: () => void }) {
  const t = itemTotals(item);
  const setGrams = (g: number) => onChange(item.per100 ? { ...item, grams: g } : scaleEstimate(item, g));
  const estimated = item.source === "ai_estimate";
  const presets = [...item.portions.filter((p) => p.grams > 0).slice(0, 3)];
  if (!presets.some((p) => p.grams === 100)) presets.push({ label: "100 g", grams: 100 });
  return (
    <div className="rounded-[16px] border border-line bg-surface-2 p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <p className="font-semibold leading-snug">{item.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {estimated ? (
              <span className="text-carbs">Estimado por el Profe{item.confidence != null && item.confidence < 0.5 ? " · revisalo" : ""}</span>
            ) : (
              <span>{item.source === "local" ? "Base NutriFit" : item.source === "off" ? "Open Food Facts" : item.source === "usda" ? "USDA" : "Tuyo"}</span>
            )}
          </p>
        </div>
        <button type="button" onClick={onRemove} aria-label={`Quitar ${item.name}`} className="grid size-9 place-items-center rounded-full text-muted hover:text-alert">
          <Trash2 className="size-4.5" />
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setGrams(p.grams)}
            className={cn("rounded-[9px] border px-2.5 py-1.5 text-xs font-medium", item.grams === p.grams ? "border-accent text-accent" : "border-line text-muted")}
          >
            {p.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1 rounded-[9px] border border-line bg-surface px-2 py-1">
          <span className="sr-only">Gramos</span>
          <input
            type="number"
            inputMode="numeric"
            value={item.grams}
            onChange={(e) => setGrams(Math.max(1, Number(e.target.value) || 1))}
            className="tnum w-14 bg-transparent text-right text-sm font-semibold outline-none"
          />
          <span className="text-xs text-muted">g</span>
        </label>
      </div>
      <p className="tnum mt-2 text-sm">
        <span className="font-semibold">{fmt(t.kcal)} kcal</span>
        <span className="text-muted">
          {" "}
          · P {fmt1(t.protein_g)} · C {fmt1(t.carbs_g)} · G {fmt1(t.fat_g)}
        </span>
      </p>
    </div>
  );
}
