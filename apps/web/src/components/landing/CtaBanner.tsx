"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { LANDING_SCIENTISTS } from "./content";

export function CtaBanner() {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(135deg,#080c09_0%,#0f1a14_100%)] px-4 py-28 text-[#f4f0e6] md:px-8">
      <div className="absolute inset-0 arena-grid opacity-20" />

      {/* ambient orbs */}
      <div
        className="pointer-events-none absolute -right-32 -top-32 h-[500px] w-[500px] animate-orb-breath rounded-full opacity-22"
        style={{ background: "radial-gradient(circle at center, var(--accent-primary) 0%, transparent 68%)", filter: "blur(8px)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-24 h-[380px] w-[380px] animate-orb-breath rounded-full opacity-16"
        style={{ background: "radial-gradient(circle at center, var(--accent-secondary) 0%, transparent 68%)", filter: "blur(10px)", animationDelay: "2s" }}
      />

      {/* floating decorative cards (right side) */}
      <div className="pointer-events-none absolute -right-4 top-1/2 hidden -translate-y-1/2 md:block">
        {LANDING_SCIENTISTS.slice(0, 2).map((s, i) => (
          <div
            key={s.id}
            className="animate-float-card mb-6 flex w-[110px] flex-col items-center rounded-2xl border-[3px] border-[rgba(248,214,148,0.2)] bg-[rgba(255,255,255,0.04)] p-3 backdrop-blur-sm"
            style={{ "--float-rot": i === 0 ? "4deg" : "-3deg", animationDelay: `${i * 1.2}s`, opacity: 0.5 } as React.CSSProperties}
          >
            <div className="mb-1 grid h-12 w-12 place-items-center rounded-full border border-[rgba(248,214,148,0.25)] bg-[rgba(248,214,148,0.06)]">
              <span className="text-xl">{s.emoji}</span>
            </div>
            <p className="font-caprasimo text-[10px] text-[var(--tone-cream)]">{s.name}</p>
            <div className="mt-1 text-xs opacity-50">{s.baseEmoji}</div>
          </div>
        ))}
      </div>

      <div className="relative mx-auto flex max-w-7xl flex-col justify-between gap-10 md:flex-row md:items-end">
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl text-left"
        >
          <p className="font-gabarito text-xs font-bold uppercase tracking-widest opacity-60">
            The arena awaits
          </p>
          <h2 className="font-caprasimo mt-5 text-5xl leading-none md:text-7xl">
            Enter the arena of
            <br />
            <span style={{ color: "var(--tone-cream)" }}>impossible minds.</span>
          </h2>
          <p className="font-gabarito mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-muted)]">
            Build your scientist team, read your rival, and shatter the base before yours falls.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link href="/connect" className="btn-game btn-game-primary font-gabarito">
            <span className="relative z-10">Enter Arena</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="relative z-10">
              <path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}