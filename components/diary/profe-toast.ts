"use client";
import { toast } from "sonner";

/** Muestra el feedback del Profe como toast. */
export function profeToast(text: string | null | undefined, fallback = "Anotado 👌") {
  toast(text || fallback, { description: text ? "El Profe" : undefined, duration: 5000 });
}
