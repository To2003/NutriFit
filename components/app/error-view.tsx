"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { isStaleDeployError, reloadForNewVersion } from "@/lib/stale";

export function ErrorView({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = isStaleDeployError(error);
  useEffect(() => {
    if (stale) reloadForNewVersion();
  }, [stale]);

  if (stale)
    return (
      <main className="flex min-h-[70dvh] flex-col justify-center px-6">
        <p className="score text-[38px] leading-none">Se actualizó NutriFit</p>
        <p className="mt-3 text-muted">Hay una versión nueva. Si no se recarga sola, tocá el botón.</p>
        <Button className="mt-6" size="lg" onClick={() => window.location.reload()}>
          Recargar
        </Button>
      </main>
    );

  return (
    <main className="flex min-h-[70dvh] flex-col justify-center px-6">
      <p className="score text-[40px] leading-none">Se nos cayó la pelota</p>
      <p className="mt-3 text-muted">Algo falló al cargar esta pantalla. Tus datos están a salvo: probá de nuevo en un toque.</p>
      <Button className="mt-6" size="lg" onClick={reset}>
        Reintentar
      </Button>
      {error.digest ? <p className="mt-4 text-xs text-muted">Código: {error.digest}</p> : null}
    </main>
  );
}
