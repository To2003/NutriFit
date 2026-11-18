import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function MenuLink({ href, label, hint, badge }: { href: string; label: string; hint?: string; badge?: number }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-2.5 active:bg-surface-2">
      <span className="flex-1">
        <span className="block font-medium">{label}</span>
        {hint ? <span className="block text-sm text-muted">{hint}</span> : null}
      </span>
      {badge ? <span className="grid h-6 min-w-6 place-items-center rounded-full bg-alert px-1.5 text-xs font-bold text-bg">{badge}</span> : null}
      <ChevronRight className="size-5 text-muted" />
    </Link>
  );
}
