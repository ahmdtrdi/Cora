"use client";

import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { LANDING_STAGES } from "./content";
import { getLandingAccentStyle } from "./visuals";

export function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const progressWidth = useTransform(scrollYProgress, [0.05, 0.92], ["0%", "100%"]);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const idx = Math.min(LANDING_STAGES.length - 1, Math.floor(latest * LANDING_STAGES.length * 0.98));
    setActive(Math.max(0, idx));
  });

  const stage = LANDING_STAGES[active];
  const stageStyle = useMemo(() => getLandingAccentStyle(stage.accent), [stage.accent]);

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
            Match Architecture
          </p>
          <h2 className="font-caprasimo mt-3 text-3xl leading-tight md:text-5xl">
            4 phases, 2 on-chain transactions.
          </h2>
        </motion.div>

        <div className="mb-10 flex items-center gap-2">
          {LANDING_STAGES.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`font-gabarito flex h-8 w-8 items-center justify-center rounded-full border text-xs font-black transition-all duration-300 ${
                  i === active
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[#fffaf0] shadow-[0_0_14px_var(--accent-primary-glow)]"
                    : i < active
                      ? "border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--foreground)]"
                      : "border-[var(--color-border)] bg-transparent text-[var(--color-muted)]"
                }`}
              >
                {i < active ? "OK" : s.id}
              </div>
              {i < LANDING_STAGES.length - 1 && (
                <div className="h-px w-8 bg-[var(--color-border)]">
                  {i < active && (
                    <motion.div
                      layoutId={`connector-${i}`}
                      className="h-full bg-[var(--accent-primary)]"
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
              className="frame-cut relative overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_20px_60px_rgba(111,58,40,0.12)]"
            >
              <div className="h-1 w-full accent-bar-slide" style={{ background: stageStyle.accent }} />
              <div className="pointer-events-none absolute inset-0 arena-grid opacity-[0.16]" />
              <div
                className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl"
                style={{ background: stageStyle.dim }}
              />

              <div className="relative p-8 md:p-10">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div
                      className="frame-cut frame-cut-sm flex h-12 w-12 items-center justify-center border font-mono text-sm font-black tracking-wider"
                      style={{
                        borderColor: stageStyle.accent,
                        color: stageStyle.accent,
                        background: stageStyle.dim,
                        boxShadow: `0 0 20px ${stageStyle.glow}`,
                      }}
                    >
                      #{Number(stage.id)}
                    </div>

                    <div>
                      <p className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
                        {stage.label}
                      </p>
                      <span
                        className="font-gabarito mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                        style={{
                          background: stageStyle.dim,
                          color: stageStyle.accent,
                        }}
                      >
                        {stage.domain}
                      </span>
                    </div>
                  </div>

                  <div className="frame-cut frame-cut-sm border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 py-3 text-right">
                    <p className="font-mono text-sm font-black uppercase tracking-wide" style={{ color: stageStyle.accent }}>
                      {stage.stat}
                    </p>
                  </div>
                </div>

                <h3 className="font-caprasimo mt-7 max-w-3xl text-3xl leading-tight md:text-4xl">{stage.title}</h3>
                <p className="font-gabarito mt-4 max-w-3xl text-base leading-7 text-[var(--tone-bark)]">{stage.summary}</p>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center gap-4">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-alt)]">
              <motion.div
                className="h-full rounded-full"
                style={{ width: progressWidth, background: "var(--accent-primary)" }}
              />
            </div>
            <span className="font-mono text-xs text-[var(--color-muted)]">
              {active + 1} / {LANDING_STAGES.length}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
