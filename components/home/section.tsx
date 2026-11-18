import Link from "next/link";
import { cn } from "@/lib/utils";

export function Section({
  title,
  href,
  linkLabel,
  children,
  className,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[22px] border border-line bg-surface p-4", className)}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-semibold">{title}</h2>
        {href ? (
          <Link href={href} className="text-sm font-medium text-accent">
            {linkLabel ?? "Ver"}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
