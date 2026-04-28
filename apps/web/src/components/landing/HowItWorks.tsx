"use client";

import { motion, useMotionValueEvent, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";

const stages = [
  {
    id: "01",
    label: "Matchmaking",
    domain: "Off-chain",
    color: "var(--amber)",
    colorDim: "var(--amber-dim)",
    colorGlow: "var(--amber-glow)",
    title: "Queue, pair, open room",
    summary:
      "Player joins queue from app or Blink. FIFO pairs two players and opens a WebSocket room.",
    stat: "WebSocket",
  },
  {
    id: "02",
    label: "Escrow",
    domain: "On-chain",
    color: "var(--teal)",
    colorDim: "var(--teal-dim)",
    colorGlow: "var(--teal-glow)",
    title: "Both players deposit",
    summary:
      "Both players sign the deposit in Phantom. Anchor contract locks funds in a PDA vault.",
    stat: "Tx #1",
  },
  {
    id: "03",
    label: "Battle",
    domain: "Off-chain",
    color: "var(--amber)",
    colorDim: "var(--amber-dim)",
    colorGlow: "var(--amber-glow)",
    title: "3-round card battle",
    summary:
      "Players use randomized Action Cards (Heal/Attack). Correct GAT answers damage enemy or heal own Base HP.",
    stat: "3 rounds",
  },
  {
    id: "04",
    label: "Settlement",
    domain: "On-chain",
    color: "var(--teal)",
    colorDim: "var(--teal-dim)",
    colorGlow: "var(--teal-glow)",
    title: "Signed result, funds released",
    summary:
      "Server signs settlement authorization. Contract verifies signature and releases 97.5% to winner, 2.5% treasury.",
    stat: "Tx #2",
  },
];

export function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const progressWidth = useTransform(scrollYProgress, [0.05, 0.92], ["0%", "100%"]);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const idx = Math.min(stages.length - 1, Math.floor(latest * stages.length * 0.98));
    setActive(Math.max(0, idx));
  });

  const stage = stages[active];

  return (
    <section
      id="how-it-works"
      ref={containerRef}
      style={{ position: "relative" }}
      className="relative h-[300vh] bg-[var(--background)]"
    >
      <div className="sticky top-0 flex min-h-[100svh] flex-col items-center justify-center px-4 py-16 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12 text-center"
        >
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-black leading-tight md:text-5xl">
            4 phases, 2 on-chain transactions.
          </h2>
        </motion.div>

        <div className="mb-10 flex items-center gap-2">
          {stages.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <button
                onClick={() => {}}
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-black transition-all duration-300 ${
                  i === active
                    ? "border-[var(--amber)] bg-[var(--amber)] text-white shadow-[0_0_14px_var(--amber-glow)]"
                    : i < active
                    ? "border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--foreground)]"
                    : "border-[var(--color-border)] bg-transparent text-[var(--color-muted)]"
                }`}
              >
                {i < active ? "OK" : s.id}
              </button>
              {i < stages.length - 1 && (
                <div className="h-px w-8 bg-[var(--color-border)]">
                  {i < active && (
                    <motion.div
                      layoutId={`connector-${i}`}
                      className="h-full bg-[var(--amber)]"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      style={{ transformOrigin: "left" }}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="relative mx-auto w-full max-w-5xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -16, filter: "blur(4px)" }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              className="frame-cut relative overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_20px_60px_rgba(24,23,19,0.08)]"
            >
              <div className="h-1 w-full accent-bar-slide" style={{ background: stage.color }} />
              <div className="pointer-events-none absolute inset-0 arena-grid opacity-[0.16]" />
              <div
                className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl"
                style={{ background: stage.colorDim }}
              />

              <div className="relative p-8 md:p-10">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div
                      className="frame-cut frame-cut-sm flex h-12 w-12 items-center justify-center border font-mono text-sm font-black tracking-wider"
                      style={{
                        borderColor: stage.color,
                        color: stage.color,
                        background: stage.colorDim,
                        boxShadow: `0 0 20px ${stage.colorGlow}`,
                      }}
                    >
                      #{Number(stage.id)}
                    </div>

                    <div>
                      <p className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
                        {stage.label}
                      </p>
                      <span
                        className="mt-1 inline-flex rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest"
                        style={{
                          background: stage.colorDim,
                          color: stage.color,
                        }}
                      >
                        {stage.domain}
                      </span>
                    </div>
                  </div>

                  <div className="frame-cut frame-cut-sm border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 py-3 text-right">
                    <p
                      className="font-mono text-sm font-black uppercase tracking-wide"
                      style={{ color: stage.color }}
                    >
                      {stage.stat}
                    </p>
                  </div>
                </div>

                <h3 className="mt-7 max-w-3xl text-3xl font-black leading-tight md:text-4xl">{stage.title}</h3>
                <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--color-muted)]">{stage.summary}</p>

              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center gap-4">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-alt)]">
              <motion.div
                className="h-full rounded-full"
                style={{ width: progressWidth, background: "var(--amber)" }}
              />
            </div>
            <span className="font-mono text-xs text-[var(--color-muted)]">
              {active + 1} / {stages.length}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
