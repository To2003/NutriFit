import { cn } from "@/lib/utils";

/** Monograma del Profe: silbato estilizado sobre una "P" de marcador. */
export function ProfeMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("bg-grad grid shrink-0 place-items-center rounded-full text-white", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 32 32" width={size * 0.66} height={size * 0.66}>
        <path d="M9 26V6h8.5a6.5 6.5 0 0 1 0 13H13" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24.5" cy="24.5" r="3" fill="currentColor" />
      </svg>
    </span>
  );
}

export function ProfeBubble({
  children,
  className,
  footer,
}: {
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className={cn("flex gap-3", className)}>
      <ProfeMark />
      <div className="flex-1 rounded-[6px_20px_20px_20px] border border-violet/30 bg-grad-soft px-3.5 py-3">
        <p className="mb-0.5 text-xs font-bold tracking-wide text-protein">El Profe</p>
        <div className="text-[15px] leading-snug">{children}</div>
        {footer ? <div className="mt-2">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Marca de NutriFit (N), distinta del monograma del Profe. */
export function AppMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <span aria-hidden className={cn("bg-grad grid shrink-0 place-items-center rounded-[30%] text-white", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 32 32" width={size * 0.6} height={size * 0.6}>
        <path d="M8 26V6l16 20V6" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
