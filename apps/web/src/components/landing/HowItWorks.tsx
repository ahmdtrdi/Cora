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
  const isPrimary = stage.accent === "primary";

  return (
    <section
      id="how-it-works"
      ref={containerRef}
      className="paper-grain relative h-[300vh]"
      style={{ background: "linear-gradient(180deg, #f5edd8 0%, var(--warm-bg) 50%, #f5edd8 100%)" }}
    >
      {/* decorative blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-20 h-64 w-64 rounded-full opacity-30" style={{ background: "radial-gradient(circle, rgba(186,105,49,0.15), transparent 70%)" }} />
        <div className="absolute -right-20 bottom-20 h-72 w-72 rounded-full opacity-25" style={{ background: "radial-gradient(circle, rgba(60,92,95,0.15), transparent 70%)" }} />
      </div>

      {/* subtle dots pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(circle, var(--tone-bark) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="sticky top-0 flex min-h-[100svh] flex-col items-center justify-center px-4 py-16 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12 text-center"
        >
          <p className="font-gabarito text-xs font-bold uppercase tracking-widest text-[var(--warm-muted)]">
            How battles unfold
          </p>
          <h2 className="font-caprasimo mt-3 text-3xl leading-tight text-[var(--warm-text)] md:text-5xl">
            Pick your mind.{" "}
            <span className="text-[var(--tone-clay)]">Predict the move. Shatter the base.</span>
          </h2>
        </motion.div>

        {/* step indicators */}
        <div className="mb-10 flex items-center gap-2">
          {LANDING_STAGES.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`font-gabarito flex h-9 w-9 items-center justify-center rounded-xl border-[2.5px] text-xs font-black transition-all duration-300 ${
                  i === active
                    ? "shadow-md"
                    : ""
                }`}
                style={{
                  borderColor: i === active ? (isPrimary ? "var(--tone-clay)" : "var(--tone-teal)") : "var(--warm-border)",
                  background: i === active ? (isPrimary ? "var(--tone-clay)" : "var(--tone-teal)") : i < active ? "var(--warm-surface)" : "transparent",
                  color: i === active ? "#fffaf0" : i < active ? "var(--warm-text)" : "var(--warm-muted)",
                }}
              >
                {i < active ? "✓" : s.id}
              </div>
              {i < LANDING_STAGES.length - 1 && (
                <div className="h-0.5 w-8 rounded-full bg-[var(--warm-border)]">
                  {i < active && (
                    <motion.div
                      layoutId={`connector-${i}`}
                      className="h-full rounded-full"
                      style={{ background: "var(--tone-clay)" }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* stage card */}
        <div className="relative mx-auto w-full max-w-5xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -16, filter: "blur(4px)" }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              className="game-card relative overflow-hidden"
            >
              {/* top accent bar */}
              <div className="h-1.5 w-full rounded-t-2xl accent-bar-slide" style={{ background: stageStyle.accent }} />

              {/* decorative blob inside card */}
              <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full opacity-20 blur-3xl" style={{ background: isPrimary ? "rgba(186,105,49,0.3)" : "rgba(60,92,95,0.3)" }} />

              <div className="relative p-8 md:p-10">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl border-[2.5px] font-mono text-sm font-black tracking-wider"
                      style={{
                        borderColor: stageStyle.accent,
                        color: stageStyle.accent,
                        background: isPrimary ? "rgba(186,105,49,0.1)" : "rgba(60,92,95,0.1)",
                      }}
                    >
                      #{Number(stage.id)}
                    </div>
                    <div>
                      <p className="font-gabarito text-xs font-bold uppercase tracking-widest text-[var(--warm-muted)]">
                        {stage.label}
                      </p>
                      <span
                        className="font-gabarito mt-1 inline-flex rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                        style={{
                          background: isPrimary ? "rgba(186,105,49,0.1)" : "rgba(60,92,95,0.1)",
                          color: stageStyle.accent,
                        }}
                      >
                        {stage.domain}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border-[2.5px] border-[var(--warm-border)] bg-[var(--warm-bg)] px-4 py-3 text-right">
                    <p className="font-mono text-sm font-black uppercase tracking-wide" style={{ color: stageStyle.accent }}>
                      {stage.stat}
                    </p>
                  </div>
                </div>

                <h3 className="font-caprasimo mt-7 max-w-3xl text-3xl leading-tight text-[var(--warm-text)] md:text-4xl">{stage.title}</h3>
                <p className="font-gabarito mt-4 max-w-3xl text-base leading-7 text-[var(--warm-muted)]">{stage.summary}</p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* progress bar */}
          <div className="mt-6 flex items-center gap-4">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--warm-border)]">
              <motion.div
                className="h-full rounded-full"
                style={{ width: progressWidth, background: "var(--tone-clay)" }}
              />
            </div>
            <span className="font-mono text-xs text-[var(--warm-muted)]">
              {active + 1} / {LANDING_STAGES.length}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
