"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const thumbnailBackground = `
  radial-gradient(circle at 18% 22%, rgba(186, 105, 49, 0.35), transparent 40%),
  radial-gradient(circle at 78% 68%, rgba(157, 180, 150, 0.2), transparent 44%),
  linear-gradient(135deg, rgba(157, 180, 150, 0.08), rgba(39, 65, 55, 0.12)),
  linear-gradient(0deg, rgba(15, 26, 20, 0.9), rgba(15, 26, 20, 0.9))
`;

export function VideoSlot() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const introOpacity = useTransform(scrollYProgress, [0.05, 0.26, 0.5], [1, 1, 0]);
  const introScale = useTransform(scrollYProgress, [0.05, 0.5], [1.2, 1]);
  const introY = useTransform(scrollYProgress, [0.05, 0.5], ["2%", "-8%"]);

  const boxScale = useTransform(scrollYProgress, [0.2, 0.58], [1.14, 1]);
  const boxOpacity = useTransform(scrollYProgress, [0.18, 0.48], [0, 1]);
  const boxY = useTransform(scrollYProgress, [0.2, 0.58], ["8%", "0%"]);
  const boxBgScale = useTransform(scrollYProgress, [0.2, 0.58], [1.26, 1]);
  const boxExitY = useTransform(scrollYProgress, [0.74, 1], ["0%", "-8%"]);

  return (
    <section
      id="replay"
      ref={containerRef}
      style={{ position: "relative" }}
      className="relative min-h-[220vh] bg-[radial-gradient(circle_at_10%_76%,rgba(157,180,150,0.14),transparent_44%),radial-gradient(circle_at_84%_24%,rgba(39,65,55,0.35),transparent_40%),linear-gradient(150deg,#0d1811_0%,#0f1a14_50%,#0d1710_100%)]"
    >
      <div className="sticky top-0 flex min-h-[100svh] items-center overflow-hidden px-4 py-14 md:px-8 md:py-16">
        <motion.div
          style={{ opacity: introOpacity, scale: introScale, y: introY, background: thumbnailBackground }}
          className="frame-cut absolute inset-4 -z-10 overflow-hidden border border-[var(--color-border)] md:inset-8"
        >
          <div className="arena-grid absolute inset-0 opacity-35" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(15,26,20,0.1),rgba(15,26,20,0.7))]" />
        </motion.div>

        <motion.div
          style={{ opacity: introOpacity }}
          className="pointer-events-none absolute inset-x-4 top-1/2 z-10 -translate-y-1/2 text-center md:inset-x-8"
        >
          <p className="font-gabarito text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
            Watch the duel flow
          </p>
          <h2 className="font-caprasimo mx-auto mt-4 max-w-5xl text-4xl leading-tight md:text-6xl">
            See how brilliant minds{" "}
            <span className="text-[var(--tone-cream)]">clash in the arena.</span>
          </h2>
        </motion.div>

        <motion.div
          style={{ scale: boxScale, opacity: boxOpacity, y: boxY }}
          className="mx-auto w-full max-w-4xl"
        >
          <motion.div
            style={{ y: boxExitY }}
            className="frame-cut relative overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_28px_80px_rgba(111,58,40,0.14)]"
          >
            <motion.div
              className="pointer-events-none absolute inset-0 z-0"
              style={{ background: thumbnailBackground, scale: boxBgScale }}
            >
              <div className="arena-grid absolute inset-0 opacity-35" />
            </motion.div>
            <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_bottom,rgba(15,26,20,0.82),rgba(15,26,20,0.96))]" />

            <div className="relative z-10 p-4 md:p-8">
              <div className="frame-cut grid aspect-video w-full place-items-center border-2 border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                <div className="px-6 text-center">
                  <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full border-2 border-[var(--accent-primary)] bg-[var(--accent-primary-dim)]">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M8 5v14l11-7L8 5z" fill="var(--accent-primary)" />
                    </svg>
                  </div>
                  <p className="font-caprasimo text-xl text-[var(--foreground)] md:text-2xl">
                    Arena gameplay coming soon
                  </p>
                  <p className="font-gabarito mt-2 text-sm text-[var(--color-muted)]">
                    Full battle demo • Scientists vs Scientists
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
