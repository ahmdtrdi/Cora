"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export function CtaBanner() {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(135deg,#274137_0%,#6f3a28_100%)] px-4 py-28 text-[#fffaf0] md:px-8">
      <div className="absolute inset-0 arena-grid opacity-20" />

      <div
        className="pointer-events-none absolute -right-32 -top-32 h-[500px] w-[500px] animate-orb-breath rounded-full opacity-22"
        style={{
          background:
            "radial-gradient(circle at center, var(--accent-primary) 0%, transparent 68%)",
          filter: "blur(8px)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-24 h-[380px] w-[380px] animate-orb-breath rounded-full opacity-16"
        style={{
          background:
            "radial-gradient(circle at center, var(--accent-secondary) 0%, transparent 68%)",
          filter: "blur(10px)",
          animationDelay: "2s",
        }}
      />

      <div className="relative mx-auto flex max-w-7xl flex-col justify-between gap-10 md:flex-row md:items-end">
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl text-left"
        >
          <p className="font-mono text-xs font-bold uppercase tracking-widest opacity-60">
            Arena Preview
          </p>
          <h2 className="font-caprasimo mt-5 text-5xl leading-none md:text-7xl">
            Think warmer.
            <br />
            <span style={{ color: "var(--tone-cream)" }}>Battle sharper.</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link
            href="/connect"
            className="font-gabarito group relative inline-flex h-14 w-fit items-center gap-2 overflow-hidden rounded-full border border-white/40 bg-[linear-gradient(140deg,#ba6931_0%,#6f3a28_100%)] px-8 text-base font-black text-[#fffaf0] shadow-[0_12px_40px_var(--accent-primary-glow)] transition-all duration-200 before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(120deg,rgba(255,255,255,0.18),transparent_45%)] after:pointer-events-none after:absolute after:inset-[2px] after:rounded-full after:border after:border-white/35 hover:-translate-y-1 hover:shadow-[0_18px_50px_var(--accent-primary-glow)]"
          >
            <span className="relative z-10">Enter Arena</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className="relative z-10"
            >
              <path
                d="M2 8h12M10 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}