"use client";
import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";

/** Pseudo-aleatorio determinístico (puro) para la posición de cada papelito. */
const rand = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Explosión de papelitos para PRs y rachas. Respeta "reducir movimiento". */
export function Celebrate({ show }: { show: boolean }) {
  const reduce = useReducedMotion();
  const bits = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        i,
        x: (rand(i, 1) - 0.5) * 340,
        y: -(160 + rand(i, 2) * 260),
        r: rand(i, 3) * 540 - 270,
        c: ["var(--accent)", "var(--carbs)", "var(--water)", "var(--alert)", "var(--text)"][i % 5],
        w: 6 + rand(i, 4) * 6,
      })),
    [],
  );
  if (!show || reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-1/2 z-[60] flex justify-center">
      {bits.map((b) => (
        <motion.span
          key={b.i}
          className="absolute rounded-[2px]"
          style={{ background: b.c, width: b.w, height: b.w * 0.45 }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: b.x, y: [0, b.y, b.y + 520], opacity: [1, 1, 0], rotate: b.r }}
          transition={{ duration: 1.8, ease: "easeOut", times: [0, 0.35, 1] }}
        />
      ))}
    </div>
  );
}
