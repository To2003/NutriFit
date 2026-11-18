import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const nf0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

export const fmt = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "—" : nf0.format(n));
export const fmt1 = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "—" : nf1.format(n));

export function vibrate(pattern: number | number[] = 12) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* iOS no soporta vibración */
    }
  }
}
