import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function BackHeader({ title, href = "/perfil", subtitle }: { title: string; href?: string; subtitle?: string }) {
  return (
    <header className="mb-4 flex items-center gap-2">
      <Link href={href} aria-label="Volver" className="-ml-2 grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2">
        <ChevronLeft className="size-6" />
      </Link>
      <div>
        <h1 className="score text-[26px] leading-none">{title}</h1>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      </div>
    </header>
  );
}
