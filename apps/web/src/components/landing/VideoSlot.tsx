"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const thumbnailBackground = `
  radial-gradient(circle at 18% 22%, rgba(186, 105, 49, 0.24), transparent 40%),
  radial-gradient(circle at 78% 68%, rgba(157, 180, 150, 0.25), transparent 44%),
  linear-gradient(135deg, rgba(39, 65, 55, 0.08), rgba(39, 65, 55, 0.02)),
  linear-gradient(0deg, rgba(255, 250, 240, 0.76), rgba(255, 250, 240, 0.76))
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
      className="relative min-h-[220vh] bg-[var(--background)]"
    >
      <div className="sticky top-0 flex min-h-[100svh] items-center overflow-hidden px-4 py-14 md:px-8 md:py-16">
        <motion.div
          style={{ opacity: introOpacity, scale: introScale, y: introY, background: thumbnailBackground }}
          className="frame-cut absolute inset-4 -z-10 overflow-hidden border border-[var(--color-border)] md:inset-8"
        >
          <div className="arena-grid absolute inset-0 opacity-35" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,250,240,0.1),rgba(255,250,240,0.78))]" />
        </motion.div>

        <motion.div
          style={{ opacity: introOpacity }}
          className="pointer-events-none absolute inset-x-4 top-1/2 z-10 -translate-y-1/2 text-center md:inset-x-8"
        >
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
            Demo Video
          </p>
          <h2 className="font-caprasimo mx-auto mt-4 max-w-5xl text-4xl leading-tight md:text-6xl">
            Watch the scientist duel flow.
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
            <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_bottom,rgba(255,250,240,0.9),rgba(255,250,240,0.97))]" />

            <div className="relative z-10 p-4 md:p-8">
              <div className="frame-cut grid aspect-video w-full place-items-center border border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                <div className="px-6 text-center">
                  <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
                    Placeholder
                  </p>
                  <p className="font-caprasimo mt-3 text-xl md:text-2xl">Gameplay demo slot</p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}