"use client";
import { motion, useReducedMotion } from "motion/react";

const CHIPS = [
  { e: "🏐", x: "8%", y: "14%", d: 0 },
  { e: "🥗", x: "70%", y: "6%", d: 0.6 },
  { e: "💧", x: "80%", y: "52%", d: 1.2 },
  { e: "🏋️", x: "4%", y: "62%", d: 0.9 },
  { e: "🏑", x: "44%", y: "78%", d: 0.3 },
];

/** Orbe con el degradé de marca y chips de deporte/comida flotando. */
export function HeroOrb() {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className="relative mx-auto aspect-square w-full max-w-[320px]">
      <motion.div
        className="bg-grad absolute inset-[14%] rounded-full blur-[2px]"
        animate={reduce ? undefined : { scale: [1, 1.04, 1], rotate: [0, 8, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-[14%] rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.35),transparent_45%)]" />
      <div className="bg-grad absolute inset-[6%] -z-10 rounded-full opacity-40 blur-3xl" />
      {CHIPS.map((c) => (
        <motion.span
          key={c.e}
          className="absolute grid size-14 place-items-center rounded-2xl border border-white/15 bg-surface/80 text-2xl shadow-xl backdrop-blur"
          style={{ left: c.x, top: c.y }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={reduce ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1, y: [0, -8, 0] }}
          transition={reduce ? { duration: 0.2 } : { opacity: { delay: c.d * 0.4 }, scale: { delay: c.d * 0.4 }, y: { duration: 3.2 + c.d, repeat: Infinity, ease: "easeInOut" } }}
        >
          {c.e}
        </motion.span>
      ))}
    </div>
  );
}
