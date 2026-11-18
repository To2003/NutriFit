export const metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <p className="score text-[64px] leading-none">Sin señal</p>
      <p className="mt-4 text-muted">
        Parece que no hay internet. Cuando vuelva, cargá lo que comiste: el Profe no se va a ningún lado.
      </p>
    </main>
  );
}
