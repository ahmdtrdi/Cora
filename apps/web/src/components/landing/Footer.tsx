"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      className="border-t border-[var(--color-border)] bg-[var(--background)] px-4 py-12 md:px-8"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="frame-cut frame-cut-sm grid h-8 w-8 place-items-center border border-[var(--color-border)] text-xs font-black text-[var(--accent-primary)]">
              C
            </span>
            <span className="font-caprasimo text-xl leading-none">CORA</span>
          </div>
          <p className="font-gabarito mt-2 text-sm text-[var(--color-muted)]">
            © 2026 Cora Esports. Vintage cognitive arena prototype.
          </p>
        </div>

        <div className="font-gabarito flex flex-wrap items-center gap-6 text-sm font-bold text-[var(--color-muted)]">
          {[
            { label: "Discord", href: "#" },
            { label: "X / Twitter", href: "#" },
            { label: "Docs", href: "#" },
          ].map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="transition-colors duration-150 hover:text-[var(--accent-primary)]"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </motion.footer>
  );
}