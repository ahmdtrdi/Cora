"use client";

import { useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import Link from "next/link";

const links = [
  { href: "#roster", label: "Minds" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#replay", label: "Arena" },
];

export function Navbar() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setSolid(latest > 60);
  });

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed left-0 right-0 top-0 z-50 px-4 py-3 transition-all duration-300 md:px-6 ${
        solid
          ? "border-b border-[var(--color-border)] bg-[var(--background)]/90 shadow-[0_10px_30px_rgba(111,58,40,0.12)] backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <Link href="/" className="group flex items-center gap-3" aria-label="Cora home">
          <span className="frame-cut frame-cut-sm grid h-9 w-9 place-items-center border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-black text-[var(--accent-primary)] transition-all duration-200 group-hover:border-[var(--accent-primary)] group-hover:bg-[var(--accent-primary-dim)]">
            C
          </span>
          <span className="font-caprasimo text-xl leading-none tracking-tight">CORA</span>
        </Link>

        <div
          className="relative hidden items-center gap-1 md:flex"
          onMouseLeave={() => setHovered(null)}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onMouseEnter={() => setHovered(link.href)}
              className="font-gabarito relative z-10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[var(--color-muted)] transition-colors duration-150 hover:text-[var(--foreground)]"
            >
              <AnimatePresence>
                {hovered === link.href && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_8px_20px_rgba(111,58,40,0.1)]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </AnimatePresence>
              <span className="relative">{link.label}</span>
            </Link>
          ))}
        </div>

        <Link
          href="/connect"
          className="font-gabarito group relative inline-flex h-9 items-center gap-1.5 overflow-hidden rounded-full border border-white/45 bg-[linear-gradient(140deg,#ba6931_0%,#6f3a28_100%)] px-5 text-sm font-black text-[#fffaf0] shadow-[0_4px_18px_var(--accent-primary-glow)] transition-all duration-200 before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(120deg,rgba(255,255,255,0.22),transparent_45%)] after:pointer-events-none after:absolute after:inset-[2px] after:rounded-full after:border after:border-white/35 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_var(--accent-primary-glow)]"
        >
          <span className="relative z-10">Enter</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            className="relative z-10"
          >
            <path
              d="M1.5 6h9M7 2.5l3.5 3.5L7 9.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
    </motion.nav>
  );
}