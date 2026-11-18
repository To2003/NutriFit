"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { BookOpen, Dumbbell, Home, Plus, User } from "lucide-react";
import { cn, vibrate } from "@/lib/utils";
import { QuickAdd } from "@/components/diary/quick-add";

const items = [
  { href: "/inicio", label: "Inicio", Icon: Home },
  { href: "/diario", label: "Diario", Icon: BookOpen },
  { href: "/entreno", label: "Entreno", Icon: Dumbbell },
  { href: "/perfil", label: "Perfil", Icon: User },
];

export function BottomNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const link = (it: (typeof items)[number]) => {
    const active = path === it.href || path.startsWith(`${it.href}/`);
    return (
      <Link
        key={it.href}
        href={it.href}
        aria-current={active ? "page" : undefined}
        className={cn("relative flex flex-1 flex-col items-center gap-0.5 pt-2.5 pb-1 text-[11px] font-semibold", active ? "text-text" : "text-muted")}
      >
        {active ? <motion.span layoutId="nav-dot" className="bg-grad absolute top-0 h-[3px] w-8 rounded-b-full" /> : null}
        <it.Icon className="size-[22px]" strokeWidth={active ? 2.4 : 1.8} />
        {it.label}
      </Link>
    );
  };
  return (
    <>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/85 pb-[var(--safe-bottom)] backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-lg items-stretch px-2">
          {items.slice(0, 2).map(link)}
          <div className="flex flex-1 justify-center">
            <button
              type="button"
              aria-label="Cargar algo"
              aria-haspopup="dialog"
              onClick={() => {
                vibrate(10);
                setOpen(true);
              }}
              className="bg-grad -mt-5 grid size-[60px] place-items-center rounded-full text-white shadow-[0_10px_28px_-6px_rgba(176,75,214,0.8)] ring-4 ring-bg transition-transform active:scale-95"
            >
              <Plus className="size-7" strokeWidth={2.6} />
            </button>
          </div>
          {items.slice(2).map(link)}
        </div>
      </nav>
      <QuickAdd open={open} onOpenChange={setOpen} />
    </>
  );
}
