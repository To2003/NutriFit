"use client";
import { useEffect } from "react";
import { toast } from "sonner";
import { isStaleDeployError, reloadForNewVersion } from "@/lib/stale";

export function ServiceWorkerRegister() {
  // Si una acción falla porque la app abierta es de un deploy viejo, recargamos.
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isStaleDeployError(e.reason)) {
        toast("Se actualizó NutriFit. Recargando…");
        setTimeout(reloadForNewVersion, 800);
      }
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
