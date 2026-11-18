"use client";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[70dvh] flex-col justify-center px-6">
      <p className="score text-[56px] leading-none">Se nos cayó la pelota</p>
      <p className="mt-3 text-muted">Algo falló al cargar esta pantalla. Tus datos están a salvo: probá de nuevo en un toque.</p>
      <Button className="mt-6" size="lg" onClick={reset}>
        Reintentar
      </Button>
    </main>
  );
}
