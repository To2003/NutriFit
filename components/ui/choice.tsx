"use client";
import { cn, vibrate } from "@/lib/utils";

/** Chip seleccionable (multi-selección). */
export function Chip({
  selected,
  onToggle,
  children,
  className,
}: {
  selected: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => {
        vibrate(8);
        onToggle();
      }}
      className={cn(
        "min-h-11 rounded-[10px] border px-3.5 text-[15px] font-medium transition-colors active:scale-[0.97]",
        selected ? "border-accent bg-accent/12 text-accent" : "border-line bg-surface-2 text-text",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Opción única con título y descripción (radio grande). */
export function OptionCard<T extends string>({
  value,
  current,
  onSelect,
  title,
  description,
  icon,
}: {
  value: T;
  current: T | null | undefined;
  onSelect: (v: T) => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  const selected = current === value;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => {
        vibrate(8);
        onSelect(value);
      }}
      className={cn(
        "flex w-full items-start gap-3 rounded-[14px] border p-3.5 text-left transition-colors active:scale-[0.99]",
        selected ? "border-accent bg-accent/8" : "border-line bg-surface",
      )}
    >
      {icon ? <span className="mt-0.5 text-xl leading-none">{icon}</span> : null}
      <span className="flex-1">
        <span className={cn("block font-semibold", selected ? "text-accent" : "text-text")}>{title}</span>
        {description ? <span className="mt-0.5 block text-sm text-muted">{description}</span> : null}
      </span>
      <span
        aria-hidden
        className={cn(
          "mt-1 size-5 shrink-0 rounded-full border-2",
          selected ? "border-accent bg-accent shadow-[inset_0_0_0_3px_var(--surface)]" : "border-line",
        )}
      />
    </button>
  );
}

/** Control segmentado (2–4 opciones cortas). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-[12px] border border-line bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => {
            vibrate(6);
            onChange(o.value);
          }}
          className={cn(
            "h-10 flex-1 rounded-[9px] px-2 text-sm font-semibold transition-colors",
            value === o.value ? "bg-accent text-accent-ink" : "text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        vibrate(6);
        onChange(!checked);
      }}
      className="flex w-full items-center gap-3 py-2.5 text-left"
    >
      <span className="flex-1">
        <span className="block font-medium">{label}</span>
        {description ? <span className="block text-sm text-muted">{description}</span> : null}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full border transition-colors",
          checked ? "border-accent bg-accent" : "border-line bg-surface-2",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5.5 rounded-full transition-all",
            checked ? "left-[22px] bg-accent-ink" : "left-0.5 bg-muted",
          )}
        />
      </span>
    </button>
  );
}

/** Stepper numérico grande, para el gym y porciones. */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  label,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  label: string;
  suffix?: string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 100) / 100)));
  return (
    <div className="flex items-center gap-2" aria-label={label} role="group">
      <button
        type="button"
        aria-label={`Restar ${step}`}
        onClick={() => {
          vibrate(6);
          set(value - step);
        }}
        className="size-11 rounded-full border border-line bg-surface-2 text-xl font-semibold active:scale-95"
      >
        −
      </button>
      <label className="flex min-w-16 flex-1 items-baseline justify-center gap-1">
        <span className="sr-only">{label}</span>
        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => set(Number(e.target.value))}
          className="score w-full bg-transparent text-center text-3xl outline-none"
        />
        {suffix ? <span className="text-sm text-muted">{suffix}</span> : null}
      </label>
      <button
        type="button"
        aria-label={`Sumar ${step}`}
        onClick={() => {
          vibrate(6);
          set(value + step);
        }}
        className="size-11 rounded-full border border-line bg-surface-2 text-xl font-semibold active:scale-95"
      >
        +
      </button>
    </div>
  );
}
