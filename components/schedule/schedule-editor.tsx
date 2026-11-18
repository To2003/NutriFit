"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Segmented } from "@/components/ui/choice";
import { INTENSITIES, SPORT_INFO, WEEKDAY_LABELS } from "@/lib/domain/catalog";
import { SPORTS, type Sport } from "@/lib/calc/types";
import type { ScheduleItem } from "@/components/onboarding/types";

const KIND_LABEL = { training: "Entreno", match: "Partido" } as const;

export function ScheduleEditor({
  value,
  onChange,
  sportOptions,
}: {
  value: ScheduleItem[];
  onChange: (v: ScheduleItem[]) => void;
  sportOptions: Sport[];
}) {
  const [editing, setEditing] = useState<{ index: number | null; item: ScheduleItem } | null>(null);
  const defaultSport = sportOptions[0] ?? "other";
  const options = [...new Set([...sportOptions, ...SPORTS.filter((s) => s !== "gym")])];

  const save = () => {
    if (!editing) return;
    const next = [...value];
    if (editing.index === null) next.push(editing.item);
    else next[editing.index] = editing.item;
    next.sort((a, b) => a.weekday - b.weekday || (a.start_time ?? "").localeCompare(b.start_time ?? ""));
    onChange(next);
    setEditing(null);
  };

  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
        const items = value.map((it, i) => ({ it, i })).filter(({ it }) => it.weekday === wd);
        return (
          <div key={wd} className="flex min-h-14 items-center gap-3 rounded-[14px] border border-line bg-surface px-3 py-2">
            <span className="score w-10 text-xl text-muted">{WEEKDAY_LABELS[wd].short}</span>
            <div className="flex flex-1 flex-wrap gap-1.5">
              {items.length === 0 ? <span className="text-sm text-muted">Libre</span> : null}
              {items.map(({ it, i }) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setEditing({ index: i, item: it })}
                  className={
                    it.kind === "match"
                      ? "rounded-[9px] bg-accent px-2.5 py-1.5 text-sm font-semibold text-accent-ink"
                      : "rounded-[9px] bg-surface-2 px-2.5 py-1.5 text-sm font-medium"
                  }
                >
                  {SPORT_INFO[it.sport].emoji} {KIND_LABEL[it.kind]}
                  {it.start_time ? ` ${it.start_time.slice(0, 5)}` : ""}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label={`Agregar actividad el ${WEEKDAY_LABELS[wd].long}`}
              onClick={() =>
                setEditing({
                  index: null,
                  item: { weekday: wd, sport: defaultSport, kind: "training", start_time: "20:00", duration_min: 120, intensity: "moderate" },
                })
              }
              className="grid size-10 place-items-center rounded-full border border-line text-muted hover:text-text"
            >
              <Plus className="size-5" />
            </button>
          </div>
        );
      })}

      <Sheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing ? `${editing.index === null ? "Agregar" : "Editar"} · ${WEEKDAY_LABELS[editing.item.weekday].long}` : ""}
      >
        {editing ? (
          <div className="space-y-4 pb-2">
            <Field label="Deporte">
              <Select
                value={editing.item.sport}
                onChange={(e) => setEditing({ ...editing, item: { ...editing.item, sport: e.target.value as Sport } })}
              >
                {options.map((s) => (
                  <option key={s} value={s}>
                    {SPORT_INFO[s].emoji} {SPORT_INFO[s].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo">
              <Segmented
                label="Tipo"
                value={editing.item.kind}
                onChange={(k) => setEditing({ ...editing, item: { ...editing.item, kind: k, intensity: k === "match" ? "hard" : editing.item.intensity } })}
                options={[
                  { value: "training", label: "Entreno" },
                  { value: "match", label: "Partido" },
                ]}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hora">
                <Input
                  type="time"
                  value={editing.item.start_time ?? ""}
                  onChange={(e) => setEditing({ ...editing, item: { ...editing.item, start_time: e.target.value || null } })}
                />
              </Field>
              <Field label="Duración (min)">
                <Input
                  inputMode="numeric"
                  value={editing.item.duration_min}
                  onChange={(e) =>
                    setEditing({ ...editing, item: { ...editing.item, duration_min: Number(e.target.value.replace(/\D/g, "")) || 0 } })
                  }
                />
              </Field>
            </div>
            <Field label="Intensidad">
              <Segmented
                label="Intensidad"
                value={editing.item.intensity}
                onChange={(i) => setEditing({ ...editing, item: { ...editing.item, intensity: i } })}
                options={INTENSITIES.map((i) => ({ value: i.value, label: i.label }))}
              />
            </Field>
            <div className="flex gap-2 pt-2">
              {editing.index !== null ? (
                <Button
                  type="button"
                  variant="danger"
                  size="icon"
                  aria-label="Borrar actividad"
                  className="size-12 rounded-[14px]"
                  onClick={() => {
                    onChange(value.filter((_, i) => i !== editing.index));
                    setEditing(null);
                  }}
                >
                  <Trash2 className="size-5" />
                </Button>
              ) : null}
              <Button type="button" block onClick={save} disabled={editing.item.duration_min < 5}>
                Listo
              </Button>
            </div>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
