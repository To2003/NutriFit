"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Trash2 } from "lucide-react";
import { MEALS, type Meal } from "@/lib/domain/catalog";
import { deleteFoodLogAction } from "@/app/actions/food";
import { deleteActivityAction } from "@/app/actions/diary";
import { fmt, fmt1 } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FoodComposer } from "./food-composer";

export interface MealView {
  id: string;
  meal: string;
  origin: string;
  hasPhoto: boolean;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  items: { id: string; name: string; grams: number; kcal: number; source: string }[];
}

export function MealList({ meals }: { meals: MealView[] }) {
  const [adding, setAdding] = useState<Meal | null>(null);
  const [confirmDel, setConfirmDel] = useState<MealView | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-2.5">
      {MEALS.map((m) => {
        const entries = meals.filter((x) => x.meal === m.value);
        const kcal = entries.reduce((s, e) => s + e.kcal, 0);
        return (
          <section key={m.value} className="rounded-[20px] border border-line bg-surface">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <h2 className="font-semibold">
                {m.emoji} {m.label}
              </h2>
              <div className="flex items-center gap-2">
                {kcal ? <span className="tnum text-sm text-muted">{fmt(kcal)} kcal</span> : null}
                <button type="button" onClick={() => setAdding(m.value)} className="h-9 rounded-[10px] border border-line px-3 text-sm font-semibold text-accent" aria-label={`Agregar a ${m.label}`}>
                  + Agregar
                </button>
              </div>
            </div>
            {entries.length ? (
              <ul className="divide-y divide-line border-t border-line">
                {entries.map((e) => (
                  <li key={e.id} className="px-4 py-2.5">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        {e.items.map((it) => (
                          <p key={it.id} className="flex justify-between gap-3 text-[15px]">
                            <span>
                              {it.name}
                              <span className="text-muted"> · {fmt(it.grams)} g</span>
                              {it.source === "ai_estimate" ? <span className="ml-1 text-xs text-carbs">est.</span> : null}
                            </span>
                            <span className="tnum shrink-0 text-muted">{fmt(it.kcal)}</span>
                          </p>
                        ))}
                        <p className="tnum mt-1 text-xs text-muted">
                          {e.hasPhoto ? <Camera className="mr-1 inline size-3" /> : null}P {fmt1(e.protein_g)} · C {fmt1(e.carbs_g)} · G {fmt1(e.fat_g)}
                        </p>
                      </div>
                      <button type="button" onClick={() => setConfirmDel(e)} aria-label="Borrar comida" className="grid size-9 place-items-center rounded-full text-muted hover:text-alert">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
      <FoodComposer open={adding !== null} onOpenChange={(o) => !o && setAdding(null)} initialMeal={adding ?? undefined} />
      <Sheet open={confirmDel !== null} onOpenChange={(o) => !o && setConfirmDel(null)} title="¿Borrar esta comida?">
        <div className="flex gap-2 pb-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmDel(null)}>
            Dejarla
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (!confirmDel) return;
                const r = await deleteFoodLogAction(confirmDel.id);
                if (!r.ok) toast.error("No pudimos borrarla");
                setConfirmDel(null);
                router.refresh();
              })
            }
          >
            Borrar
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

export function ActivityRow({ id, label, detail }: { id: string; label: string; detail: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <li className="flex items-center gap-2 py-2">
      <span className="flex-1">
        {label}
        <span className="block text-xs text-muted">{detail}</span>
      </span>
      <button
        type="button"
        disabled={pending}
        aria-label="Borrar actividad"
        onClick={() =>
          start(async () => {
            await deleteActivityAction(id);
            router.refresh();
          })
        }
        className="grid size-9 place-items-center rounded-full text-muted hover:text-alert"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}
