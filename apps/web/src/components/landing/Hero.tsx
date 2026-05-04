"use client";

import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import type { CSSProperties, PointerEvent } from "react";
import { LANDING_SCIENTISTS, WAGER_TOKENS } from "./content";

function useVwTransform(mv: MotionValue<number>) {
  return useTransform(mv, (v) => `${v * 100}vw`);
}

function useVhTransform(mv: MotionValue<number>) {
  return useTransform(mv, (v) => `${v * 100}vh`);
}

type FloatingStyle = CSSProperties & {
  "--float-rot": string;
};

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

const CARD_POSITIONS: FloatingStyle[] = [
  { top: "15%", left: "6%", "--float-rot": "-6deg" },
  { top: "19%", right: "6%", "--float-rot": "5deg" },
  { bottom: "18%", left: "9%", "--float-rot": "4deg" },
];

function FloatingCard({ idx, delay }: { idx: number; delay: number }) {
  const scientist = LANDING_SCIENTISTS[idx];
  const isPrimary = scientist.accent === "primary";

  const accentColor = isPrimary ? "var(--tone-clay)" : "var(--tone-teal)";
  const accentDim = isPrimary
    ? "rgba(186,105,49,0.12)"
    : "rgba(60,92,95,0.12)";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      className="animate-float-card pointer-events-none absolute hidden md:block"
      style={{ ...CARD_POSITIONS[idx], animationDelay: `${delay}s` }}
    >
      <div className="relative flex w-[150px] flex-col items-center overflow-hidden rounded-[1.35rem] border-[3px] border-[var(--tone-bark)] bg-[var(--warm-surface)] p-3.5 shadow-[0_5px_0_rgba(111,58,40,0.18),0_14px_32px_rgba(0,0,0,0.22)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "linear-gradient(145deg,rgba(255,255,255,0.24),transparent 45%)",
          }}
        />

        <div
          className="relative mb-2 grid h-20 w-20 place-items-center rounded-full border-2"
          style={{
            borderColor: accentColor,
            background: accentDim,
            boxShadow: `0 0 22px ${accentDim}`,
          }}
        >
          <span className="text-3xl leading-none">{scientist.emoji}</span>
        </div>

        <p className="font-caprasimo relative text-center text-sm leading-tight text-[var(--warm-text)]">
          {scientist.name}
        </p>

        <span
          className="font-gabarito relative mt-1 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider"
          style={{
            background: accentDim,
            color: accentColor,
          }}
        >
          {scientist.archetype}
        </span>

        <div className="relative mt-2 text-center text-base opacity-75">
          {scientist.baseEmoji}
        </div>

        <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[rgba(111,58,40,0.14)]">
          <div
            className="h-full rounded-full"
            style={{ width: "78%", background: accentColor }}
          />
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

  function handlePointerMove({
    currentTarget,
    clientX,
    clientY,
  }: PointerEvent<HTMLElement>) {
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
      style={{
        background:
          "radial-gradient(ellipse at 50% 30%,rgba(186,105,49,0.18),transparent 55%),radial-gradient(ellipse at 20% 70%,rgba(60,92,95,0.12),transparent 45%),radial-gradient(ellipse at 80% 60%,rgba(157,180,150,0.10),transparent 42%),linear-gradient(165deg,#0a1410 0%,#0f1a14 40%,#121e18 70%,#0a1410 100%)",
      }}
    >
      {/* Oversized CORA emblem */}
      <div
        className="animate-slow-spin pointer-events-none absolute -z-30"
        style={{
          top: "50%",
          left: "50%",
          width: "min(80vw,700px)",
          height: "min(80vw,700px)",
        }}
      >
        <span
          className="font-caprasimo absolute inset-0 flex items-center justify-center text-[min(40vw,320px)] leading-none"
          style={{
            color: "rgba(186,105,49,0.04)",
            textShadow: "0 0 120px rgba(186,105,49,0.06)",
          }}
        >
          C
        </span>
      </div>

      {/* Science doodles */}
      {DOODLES.map((d, i) => (
        <motion.div
          key={`${d.emoji}-${i}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.16 }}
          transition={{ delay: 1.2 + i * 0.15, duration: 0.8 }}
          className="animate-drift-x pointer-events-none absolute -z-20"
          style={{
            top: d.top,
            left: d.left,
            right: d.right,
            bottom: d.bottom,
            fontSize: d.size,
            transform: `rotate(${d.rot}deg)`,
            animationDelay: `${i * 0.8}s`,
          }}
        >
          {d.emoji}
        </motion.div>
      ))}

      {/* Sparkles */}
      {SPARKLES.map((sparkle, i) => (
        <div
          key={i}
          className="animate-sparkle pointer-events-none absolute -z-20 rounded-full bg-[var(--tone-cream)]"
          style={{
            top: sparkle.top,
            left: sparkle.left,
            right: sparkle.right,
            width: sparkle.size,
            height: sparkle.size,
            animationDelay: `${sparkle.delay}s`,
            filter: "blur(0.5px)",
            boxShadow: "0 0 8px rgba(248,214,148,0.5)",
          }}
        />
      ))}

      {/* Cursor orb */}
      <motion.div
        className="pointer-events-none absolute -z-20 h-[580px] w-[580px] rounded-full"
        style={{
          left: orbLeft,
          top: orbTop,
          translateX: "-50%",
          translateY: "-50%",
          background:
            "radial-gradient(circle at center,rgba(186,105,49,0.45) 0%,rgba(186,105,49,0.18) 38%,transparent 68%)",
          mixBlendMode: "screen",
        }}
      />

      <motion.div
        className="pointer-events-none absolute -z-20 h-[720px] w-[720px] animate-orb-breath rounded-full"
        style={{
          left: orbLeft,
          top: orbTop,
          translateX: "-50%",
          translateY: "-50%",
          background:
            "radial-gradient(circle at center,rgba(157,180,150,0.18) 0%,transparent 64%)",
          filter: "blur(12px)",
        }}
      />

      {/* Vignette and depth */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(10,20,16,0.7)_100%)]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-b from-[#0a1410] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-[#0a1410] to-transparent" />

      {/* Arena floor glow */}
      <div className="pointer-events-none absolute bottom-0 left-1/2 -z-10 h-44 w-[90vw] -translate-x-1/2 rounded-[100%] bg-[radial-gradient(ellipse_at_center,rgba(186,105,49,0.24),transparent_68%)] blur-xl" />

      {/* Floating cards */}
      <FloatingCard idx={0} delay={0.6} />
      <FloatingCard idx={1} delay={0.8} />
      <FloatingCard idx={2} delay={1.0} />

      {/* Decorative base objects */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.35 }}
        transition={{ delay: 1.4, duration: 1 }}
        className="animate-float-card pointer-events-none absolute bottom-[16%] right-[8%] hidden text-4xl md:block"
        style={
          {
            "--float-rot": "-3deg",
            animationDelay: "2s",
          } as FloatingStyle
        }
      >
        🏛️
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ delay: 1.6, duration: 1 }}
        className="animate-float-card pointer-events-none absolute bottom-[32%] right-[18%] hidden text-2xl md:block"
        style={
          {
            "--float-rot": "2deg",
            animationDelay: "1s",
          } as FloatingStyle
        }
      >
        🧲
      </motion.div>

      {/* Centered content */}
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="font-gabarito mb-5 text-[13px] font-bold uppercase tracking-[0.18em] text-[var(--tone-cream)]"
        >
          A collectible battle game of brilliant minds
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="font-caprasimo text-[min(22vw,10rem)] leading-[0.9] tracking-tight text-[var(--foreground)]"
          style={{
            textShadow:
              "0 0 80px rgba(186,105,49,0.25), 0 4px 12px rgba(0,0,0,0.4)",
          }}
        >
          CORA
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.7,
            delay: 0.36,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="font-caprasimo mx-auto mt-5 max-w-xl text-xl leading-snug text-[var(--tone-cream)] sm:text-2xl md:text-3xl"
        >
          Collect scientists. Break bases. Outsmart rivals.
        </motion.p>

        {/* Token hints */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 0.86, y: 0 }}
          transition={{
            duration: 0.7,
            delay: 1,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="mt-7 flex flex-col items-center gap-2"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted)] opacity-70">
            Arena tokens
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {WAGER_TOKENS.map((token) => (
              <div
                key={token.symbol}
                className="group flex items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur-sm transition-all duration-300 hover:scale-105"
                style={{
                  borderColor: `${token.color}38`,
                  background: `${token.color}0d`,
                  boxShadow: `0 0 12px ${token.color}18`,
                }}
              >
                <span
                  className="text-sm leading-none"
                  aria-hidden="true"
                  style={{ filter: `drop-shadow(0 0 4px ${token.color}66)` }}
                >
                  {token.icon}
                </span>

                <span
                  className="font-gabarito text-[11px] font-black tracking-wide"
                  style={{ color: token.color }}
                >
                  {token.symbol}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
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
          className="h-6 w-px origin-top bg-gradient-to-b from-[var(--accent-primary)] to-transparent"
        />
      </motion.div>
    </section>
  );
}