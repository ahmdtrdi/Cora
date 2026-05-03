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
      className={`fixed left-0 right-0 top-0 z-50 px-4 py-3 transition-all duration-500 md:px-6 ${solid
        ? "border-b border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
        : "border-b border-transparent"
        }`}
      style={solid ? { backdropFilter: "blur(28px) saturate(140%)", WebkitBackdropFilter: "blur(28px) saturate(140%)", backgroundColor: "rgba(99, 99, 99, 0.55)" } : undefined}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <Link href="/" className="group flex items-center gap-3" aria-label="Cora home">
          <span className="frame-cut frame-cut-sm grid h-9 w-9 place-items-center border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-black text-[var(--accent-primary)] transition-all duration-200 group-hover:border-[var(--accent-primary)] group-hover:bg-[var(--accent-primary-dim)]">
            C
          </span>
          <span className="font-caprasimo text-xl leading-none tracking-tight text-white" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>CORA</span>
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
              className="font-gabarito relative z-10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white/80 transition-colors duration-150 hover:text-white"
              style={{ textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}
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
          className="btn-game btn-game-primary font-gabarito !px-5 !py-2 !text-sm"
          style={{ borderWidth: "2px" }}
        >
          <span className="relative z-10">Enter Arena</span>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="relative z-10"><path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Link>
      </div>
    </motion.nav>
  );
}