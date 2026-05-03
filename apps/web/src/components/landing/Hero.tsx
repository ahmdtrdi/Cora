"use client";

import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import type { PointerEvent } from "react";
import Link from "next/link";
import { LANDING_SCIENTISTS } from "./content";

function useVwTransform(mv: MotionValue<number>) {
  return useTransform(mv, (v) => `${v * 100}vw`);
}
function useVhTransform(mv: MotionValue<number>) {
  return useTransform(mv, (v) => `${v * 100}vh`);
}

const SPARKLES = [
  { top: "12%", left: "8%", size: 6, delay: 0 },
  { top: "22%", right: "11%", size: 5, delay: 0.7 },
  { top: "68%", left: "14%", size: 4, delay: 1.4 },
  { top: "74%", right: "9%", size: 7, delay: 0.3 },
  { top: "38%", left: "4%", size: 5, delay: 2.0 },
  { top: "44%", right: "5%", size: 4, delay: 1.1 },
];

const DOODLES = [
  { emoji: "⚛️", top: "18%", left: "6%", size: 28, rot: -15 },
  { emoji: "🔭", top: "26%", right: "7%", size: 26, rot: 12 },
  { emoji: "📐", bottom: "22%", left: "9%", size: 24, rot: 8 },
  { emoji: "🧬", bottom: "28%", right: "6%", size: 22, rot: -20 },
  { emoji: "⚗️", top: "55%", left: "3%", size: 20, rot: 5 },
  { emoji: "📖", top: "60%", right: "4%", size: 22, rot: -8 },
];

const CARD_POSITIONS: React.CSSProperties[] = [
  { top: "16%", left: "6%", "--float-rot": "-6deg" } as React.CSSProperties,
  { top: "20%", right: "6%", "--float-rot": "5deg" } as React.CSSProperties,
  { bottom: "18%", left: "10%", "--float-rot": "4deg" } as React.CSSProperties,
];

function FloatingCard({ idx, delay }: { idx: number; delay: number }) {
  const s = LANDING_SCIENTISTS[idx];
  const isPrimary = s.accent === "primary";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      className="animate-float-card pointer-events-none absolute hidden md:block"
      style={{ ...CARD_POSITIONS[idx], animationDelay: `${delay}s` }}
    >
      <div className="flex w-[130px] flex-col items-center overflow-hidden rounded-2xl border-[3px] border-[var(--tone-bark)] bg-[var(--warm-surface)] p-3 shadow-[0_4px_0_rgba(111,58,40,0.15),0_8px_20px_rgba(111,58,40,0.12)]">
        <div
          className="mb-2 grid h-16 w-16 place-items-center rounded-full border-2"
          style={{
            borderColor: isPrimary ? "var(--tone-clay)" : "var(--tone-teal)",
            background: isPrimary ? "rgba(186,105,49,0.12)" : "rgba(60,92,95,0.12)",
          }}
        >
          <span className="text-2xl">{s.emoji}</span>
        </div>
        <p className="font-caprasimo text-center text-xs leading-tight text-[var(--warm-text)]">{s.name}</p>
        <span
          className="font-gabarito mt-1 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider"
          style={{
            background: isPrimary ? "rgba(186,105,49,0.15)" : "rgba(60,92,95,0.15)",
            color: isPrimary ? "var(--tone-clay)" : "var(--tone-teal)",
          }}
        >
          {s.archetype}
        </span>
        <div className="mt-2 text-center text-sm opacity-70">{s.baseEmoji}</div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[rgba(111,58,40,0.12)]">
          <div className="h-full rounded-full" style={{ width: "78%", background: isPrimary ? "var(--tone-clay)" : "var(--tone-teal)" }} />
        </div>
      </div>
    </motion.div>
  );
}

export function Hero() {
  const rawX = useMotionValue(0.5);
  const rawY = useMotionValue(0.5);
  const orbX = useSpring(rawX, { damping: 26, stiffness: 85, mass: 0.55 });
  const orbY = useSpring(rawY, { damping: 26, stiffness: 85, mass: 0.55 });
  const orbLeft = useVwTransform(orbX);
  const orbTop = useVhTransform(orbY);

  function handlePointerMove({ currentTarget, clientX, clientY }: PointerEvent<HTMLElement>) {
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    rawX.set((clientX - left) / width);
    rawY.set((clientY - top) / height);
  }

  function handlePointerLeave() {
    rawX.set(0.5);
    rawY.set(0.5);
  }

  return (
    <section
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden px-4"
      style={{ background: "radial-gradient(ellipse at 50% 30%,rgba(186,105,49,0.18),transparent 55%),radial-gradient(ellipse at 20% 70%,rgba(60,92,95,0.12),transparent 45%),radial-gradient(ellipse at 80% 60%,rgba(157,180,150,0.10),transparent 42%),linear-gradient(165deg,#0a1410 0%,#0f1a14 40%,#121e18 70%,#0a1410 100%)" }}
    >
      {/* oversized CORA emblem */}
      <div className="animate-slow-spin pointer-events-none absolute -z-30" style={{ top: "50%", left: "50%", width: "min(80vw,700px)", height: "min(80vw,700px)" }}>
        <span className="font-caprasimo absolute inset-0 flex items-center justify-center text-[min(40vw,320px)] leading-none" style={{ color: "rgba(186,105,49,0.04)", textShadow: "0 0 120px rgba(186,105,49,0.06)" }}>C</span>
      </div>

      {/* science doodles */}
      {DOODLES.map((d, i) => (
        <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 0.25 }} transition={{ delay: 1.2 + i * 0.15, duration: 0.8 }} className="animate-drift-x pointer-events-none absolute -z-20" style={{ top: d.top, left: d.left, right: (d as Record<string, unknown>).right as string | undefined, bottom: (d as Record<string, unknown>).bottom as string | undefined, fontSize: d.size, transform: `rotate(${d.rot}deg)`, animationDelay: `${i * 0.8}s` }}>
          {d.emoji}
        </motion.div>
      ))}

      {/* sparkles */}
      {SPARKLES.map((s, i) => (
        <div key={i} className="animate-sparkle pointer-events-none absolute -z-20 rounded-full bg-[var(--tone-cream)]" style={{ top: s.top, left: s.left, right: (s as Record<string, unknown>).right as string | undefined, width: s.size, height: s.size, animationDelay: `${s.delay}s`, filter: "blur(0.5px)", boxShadow: "0 0 8px rgba(248,214,148,0.5)" }} />
      ))}

      {/* cursor orb */}
      <motion.div className="pointer-events-none absolute -z-20 h-[580px] w-[580px] rounded-full" style={{ left: orbLeft, top: orbTop, translateX: "-50%", translateY: "-50%", background: "radial-gradient(circle at center,rgba(186,105,49,0.45) 0%,rgba(186,105,49,0.18) 38%,transparent 68%)", mixBlendMode: "screen" }} />
      <motion.div className="pointer-events-none absolute -z-20 h-[720px] w-[720px] animate-orb-breath rounded-full" style={{ left: orbLeft, top: orbTop, translateX: "-50%", translateY: "-50%", background: "radial-gradient(circle at center,rgba(157,180,150,0.18) 0%,transparent 64%)", filter: "blur(12px)" }} />

      {/* vignette */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(10,20,16,0.7)_100%)]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-b from-[#0a1410] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-[#0a1410] to-transparent" />

      {/* floating cards */}
      <FloatingCard idx={0} delay={0.6} />
      <FloatingCard idx={1} delay={0.8} />
      <FloatingCard idx={2} delay={1.0} />

      {/* decorative base objects */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.35 }} transition={{ delay: 1.4, duration: 1 }} className="animate-float-card pointer-events-none absolute bottom-[16%] right-[8%] hidden text-4xl md:block" style={{ "--float-rot": "-3deg", animationDelay: "2s" } as React.CSSProperties}>🏛️</motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} transition={{ delay: 1.6, duration: 1 }} className="animate-float-card pointer-events-none absolute bottom-[32%] right-[18%] hidden text-2xl md:block" style={{ "--float-rot": "2deg", animationDelay: "1s" } as React.CSSProperties}>🧲</motion.div>

      {/* centered content */}
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }} className="font-gabarito mb-5 text-[13px] font-bold uppercase tracking-[0.18em] text-[var(--tone-cream)]">
          A collectible battle game of brilliant minds
        </motion.p>

        <motion.h1 initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.22, ease: [0.16, 1, 0.3, 1] }} className="font-caprasimo text-[min(22vw,10rem)] leading-[0.9] tracking-tight text-[var(--foreground)]" style={{ textShadow: "0 0 80px rgba(186,105,49,0.25), 0 4px 12px rgba(0,0,0,0.4)" }}>
          CORA
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.36, ease: [0.16, 1, 0.3, 1] }} className="font-caprasimo mx-auto mt-5 max-w-xl text-xl leading-snug text-[var(--tone-cream)] sm:text-2xl md:text-3xl">
          Collect scientists. Break their bases. Outsmart the arena.
        </motion.p>

        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.48, ease: [0.16, 1, 0.3, 1] }} className="font-gabarito mx-auto mt-5 max-w-lg text-base font-medium leading-relaxed text-[var(--color-muted)] sm:text-lg">
          Build a team of brilliant minds, predict your rival&apos;s moves, and destroy their iconic base before yours falls.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.62, ease: [0.16, 1, 0.3, 1] }} className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link href="/connect" className="btn-game btn-game-primary font-gabarito">
            Enter Arena
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          <Link href="#roster" className="btn-game btn-game-secondary font-gabarito">
            Meet the Minds
          </Link>
        </motion.div>
      </div>

      {/* scroll indicator */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ delay: 1.4, duration: 0.8 }} className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted)]">Scroll</span>
        <motion.div animate={{ scaleY: [1, 0.4, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }} className="h-6 w-px origin-top bg-gradient-to-b from-[var(--accent-primary)] to-transparent" />
      </motion.div>
    </section>
  );
}
