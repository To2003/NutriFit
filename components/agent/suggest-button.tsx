"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChefHat, Loader2, Timer } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Chip } from "@/components/ui/choice";
import { MEALS, type Meal } from "@/lib/domain/catalog";
import { fmt } from "@/lib/utils";
import { ideaToDraftAction, suggestMealsAction } from "@/app/actions/agent";
import type { MealIdea } from "@/lib/agent/suggest-fallback";
import type { DraftItem } from "@/lib/food/types";
import { defaultMealForHour } from "@/components/app/app-context";
import { FoodComposer } from "@/components/diary/food-composer";
import { ProfeMark } from "@/components/ui/profe";

export function SuggestButton() {
  const [open, setOpen] = useState(false);
  const [meal, setMeal] = useState<Meal>(defaultMealForHour(new Date().getHours()));
  const [pantry, setPantry] = useState("");
  const [ideas, setIdeas] = useState<MealIdea[] | null>(null);
  const [source, setSource] = useState<"ai" | "fallback">("ai");
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<DraftItem[] | null>(null);

  const ask = () =>
    start(async () => {
      const r = await suggestMealsAction({ meal, pantry });
      if (!r.ok) return void toast.error(r.error);
      setIdeas(r.ideas);
      setSource(r.source);
    });

  const register = (idea: MealIdea) =>
    start(async () => {
      const r = await ideaToDraftAction(idea);
      if (!r.ok) return void toast.error(r.error);
      setOpen(false);
      setTimeout(() => setDraft(r.items), 150);
    });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIdeas(null);
          setOpen(true);
        }}
        className="flex w-full items-center gap-3 rounded-[20px] border border-accent/40 bg-accent/8 p-3.5 text-left active:scale-[0.99]"
      >
        <ProfeMark />
        <span className="flex-1">
          <span className="block font-semibold">¿Qué como?</span>
          <span className="block text-sm text-muted">3 ideas según lo que te falta hoy</span>
        </span>
        <ChefHat className="size-5 text-accent" />
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="¿Qué como?" description="Decime el momento y, si querés, qué tenés en casa.">
        <div className="space-y-3 pb-3">
          <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]">
            {MEALS.map((m) => (
              <Chip key={m.value} selected={meal === m.value} onToggle={() => setMeal(m.value)} className="shrink-0">
                {m.emoji} {m.label}
              </Chip>
            ))}
          </div>
          <Input value={pantry} onChange={(e) => setPantry(e.target.value)} placeholder="Ej.: tengo huevos, arroz y atún" aria-label="Qué tenés en casa" maxLength={300} />
          <Button block size="lg" onClick={ask} disabled={pending}>
            {pending && !ideas ? <Loader2 className="size-5 animate-spin" /> : null}
            {ideas ? "Otras ideas" : "Dame ideas"}
          </Button>
          {ideas ? (
            <>
              {source === "fallback" ? <p className="text-sm text-muted">El Profe está sin señal: van ideas de la casa.</p> : null}
              <ul className="space-y-2.5">
                {ideas.map((i) => (
                  <li key={i.nombre} className="rounded-[18px] border border-line bg-surface-2 p-3.5">
                    <p className="font-semibold">{i.nombre}</p>
                    <p className="mt-1 text-sm text-muted">{i.receta}</p>
                    <p className="tnum mt-2 text-sm">
                      <span className="font-semibold">{fmt(i.kcal)} kcal</span>
                      <span className="text-muted">
                        {" "}
                        · P {fmt(i.proteina)} · C {fmt(i.carbos)} · G {fmt(i.grasa)}
                      </span>
                      <span className="ml-2 inline-flex items-center gap-1 text-muted">
                        <Timer className="size-3.5" /> {i.tiempo_min}′
                      </span>
                    </p>
                    <Button className="mt-3" size="sm" block variant="secondary" disabled={pending} onClick={() => register(i)}>
                      Registrar esta
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </Sheet>
      <FoodComposer open={draft !== null} onOpenChange={(o) => !o && setDraft(null)} initialItems={draft ?? undefined} initialMeal={meal} origin="suggestion" />
    </>
  );
}
