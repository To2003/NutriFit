"use client";
import { publicEnv } from "@/lib/env";
import { savePushSubscription } from "@/app/actions/push";

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushResult = { ok: true } | { ok: false; reason: "unsupported" | "ios_needs_install" | "denied" | "no_key" | "error" };

/** Pide permiso, se suscribe y guarda la suscripción. */
export async function enablePush(): Promise<PushResult> {
  if (isIOS() && !isStandalone()) return { ok: false, reason: "ios_needs_install" };
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  if (!publicEnv.vapidPublicKey) return { ok: false, reason: "no_key" };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "denied" };
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicEnv.vapidPublicKey) }));
    const json = sub.toJSON();
    const r = await savePushSubscription({
      endpoint: json.endpoint!,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
      userAgent: navigator.userAgent.slice(0, 200),
    });
    return r.ok ? { ok: true } : { ok: false, reason: "error" };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export const PUSH_REASON_COPY: Record<Exclude<PushResult, { ok: true }>["reason"], string> = {
  unsupported: "Este navegador no soporta notificaciones. Probá con Chrome o instalando la app.",
  ios_needs_install: "En iPhone primero agregá NutriFit a la pantalla de inicio (Compartir → Agregar a inicio) y abrila desde ahí.",
  denied: "Bloqueaste las notificaciones. Las podés habilitar desde los ajustes del navegador.",
  no_key: "Las notificaciones todavía no están configuradas en el servidor.",
  error: "No pudimos activar las notificaciones. Probá de nuevo en un rato.",
};
