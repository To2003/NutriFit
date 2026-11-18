import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <p className="score text-[64px] leading-none">Pelota afuera</p>
      <p className="mt-3 text-muted">Esta página no existe o no la podés ver.</p>
      <Link href="/inicio" className="mt-6 font-semibold text-accent">
        Volver al inicio
      </Link>
    </main>
  );
}
