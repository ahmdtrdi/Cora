"use client";

import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import type { PointerEvent } from "react";

/** Maps a 0→1 ratio to a viewport-width-relative CSS string */
function useVwTransform(mv: MotionValue<number>) {
  return useTransform(mv, (v) => `${v * 100}vw`);
}
function useVhTransform(mv: MotionValue<number>) {
  return useTransform(mv, (v) => `${v * 100}vh`);
}

export function Hero() {
  /* Raw pointer ratios (0..1) */
  const rawX = useMotionValue(0.5);
  const rawY = useMotionValue(0.5);

  /* Smooth-spring versions */
  const orbX = useSpring(rawX, { damping: 26, stiffness: 85, mass: 0.55 });
  const orbY = useSpring(rawY, { damping: 26, stiffness: 85, mass: 0.55 });

  /* Parallax offsets for the grid */
  const gridRawX = useMotionValue(0);
  const gridRawY = useMotionValue(0);
  const gridX = useSpring(gridRawX, { damping: 42, stiffness: 110 });
  const gridY = useSpring(gridRawY, { damping: 42, stiffness: 110 });

  /* Convert orb ratio to CSS viewport units for absolute positioning */
  const orbLeft = useVwTransform(orbX);
  const orbTop  = useVhTransform(orbY);

  function handlePointerMove({ currentTarget, clientX, clientY }: PointerEvent<HTMLElement>) {
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    rawX.set((clientX - left) / width);
    rawY.set((clientY - top) / height);
    gridRawX.set(((clientX - left) / width - 0.5) * 18);
    gridRawY.set(((clientY - top) / height - 0.5) * 13);
  }

  function handlePointerLeave() {
    rawX.set(0.5);
    rawY.set(0.5);
    gridRawX.set(0);
    gridRawY.set(0);
  }

  return (
    <section
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ position: "relative" }}
      className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden px-4"
    >
      {/* Parallax grid */}
      <motion.div
        className="arena-grid absolute -inset-[6%] -z-30"
        style={{ x: gridX, y: gridY }}
      />

      {/* ── Cursor-following amber orb ── */}
      <motion.div
        className="pointer-events-none absolute -z-20 h-[580px] w-[580px] rounded-full"
        style={{
          left: orbLeft,
          top: orbTop,
          translateX: "-50%",
          translateY: "-50%",
          background:
            "radial-gradient(circle at center, rgba(217,119,6,0.40) 0%, rgba(217,119,6,0.16) 38%, transparent 68%)",
          filter: "blur(0px)",
          mixBlendMode: "multiply",
        }}
      />
      {/* Soft halo behind the orb */}
      <motion.div
        className="pointer-events-none absolute -z-20 h-[720px] w-[720px] animate-orb-breath rounded-full"
        style={{
          left: orbLeft,
          top: orbTop,
          translateX: "-50%",
          translateY: "-50%",
          background:
            "radial-gradient(circle at center, rgba(251,191,36,0.12) 0%, transparent 64%)",
          filter: "blur(12px)",
        }}
      />

      {/* Edge fades */}
      <div className="absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-b from-[var(--background)] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-[var(--background)] to-transparent" />

      {/* ── Content ── */}
      <div className="relative z-10 text-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--color-muted)]"
        >
          Cognitive Wager Arena · Solana Devnet
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="text-[min(22vw,9rem)] font-black leading-none tracking-tight text-[var(--foreground)]"
        >
          CORA
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-7 max-w-md text-base font-medium leading-relaxed text-[var(--color-muted)] sm:text-lg"
        >
          Think fast. Solve clean. Outplay the arena.
        </motion.p>

      </div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 1.4, duration: 0.8 }}
        className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted)]">
          Scroll
        </span>
        <motion.div
          animate={{ scaleY: [1, 0.4, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          className="h-6 w-px origin-top bg-gradient-to-b from-[var(--amber)] to-transparent"
        />
      </motion.div>
    </section>
  );
}
