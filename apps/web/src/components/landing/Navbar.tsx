"use client";

import { useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useScroll,
  AnimatePresence,
} from "framer-motion";
import Link from "next/link";

const links = [
  { href: "#how-it-works", label: "Flow" },
  { href: "#roster",       label: "System" },
  { href: "#replay",       label: "Replay" },
];

export function Navbar() {
  const { scrollY } = useScroll();
  const [solid, setSolid]       = useState(false);
  const [hovered, setHovered]   = useState<string | null>(null);

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
          ? "border-b border-[var(--color-border)] bg-[var(--background)]/88 shadow-[0_4px_24px_rgba(24,23,19,0.06)] backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-3" aria-label="Cora home">
          <span className="frame-cut frame-cut-sm grid h-9 w-9 place-items-center border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-black text-[var(--amber)] transition-all duration-200 group-hover:border-[var(--amber)] group-hover:bg-[var(--amber-dim)]">
            C
          </span>
          <span className="text-lg font-black tracking-tight">CORA</span>
        </Link>

        {/* Center links with sliding pill indicator */}
        <div
          className="relative hidden items-center gap-1 md:flex"
          onMouseLeave={() => setHovered(null)}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onMouseEnter={() => setHovered(link.href)}
              className="relative z-10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[var(--color-muted)] transition-colors duration-150 hover:text-[var(--foreground)]"
            >
              <AnimatePresence>
                {hovered === link.href && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-[var(--color-surface)] shadow-sm"
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
          className="group relative inline-flex h-9 items-center gap-1.5 overflow-hidden rounded-full border border-white/30 bg-[linear-gradient(140deg,#d97706_0%,#b45309_100%)] px-5 text-sm font-black text-white shadow-[0_4px_18px_var(--amber-glow)] transition-all duration-200 before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(120deg,rgba(255,255,255,0.18),transparent_45%)] after:pointer-events-none after:absolute after:inset-[2px] after:rounded-full after:border after:border-white/35 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_var(--amber-glow)]"
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
