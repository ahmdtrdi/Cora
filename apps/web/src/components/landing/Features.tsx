"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  LANDING_SCIENTISTS,
  type ScientistProfile,
} from "./content";
import { getLandingAccentStyle } from "./visuals";

function getDrawerClass(index: number) {
  switch (index) {
    case 0:
      return "sm:left-full sm:-ml-4 lg:left-full lg:-ml-4";
    case 1:
      return "sm:right-full sm:-mr-4 lg:left-full lg:right-auto lg:-ml-4 lg:-mr-0";
    case 2:
      return "sm:left-full sm:-ml-4 lg:right-full lg:left-auto lg:-mr-4 lg:-ml-0";
    default:
      return "";
  }
}

function portraitInitial(name: string) {
  return name.charAt(0).toUpperCase();
}

function ScientistCard({
  scientist,
  index,
  isExpanded,
  onToggle,
}: {
  scientist: ScientistProfile;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const accentStyle = useMemo(() => getLandingAccentStyle(scientist.accent), [scientist.accent]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95, filter: "blur(12px)" }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        type: "spring",
        stiffness: 95,
        damping: 20,
        mass: 0.85,
        delay: index * 0.1,
      }}
      className={`group relative ${isExpanded ? "z-50" : "z-10 hover:z-20"}`}
    >
      <div
        className="absolute -inset-0.5 rounded-2xl opacity-0 blur-xl transition duration-500 group-hover:opacity-40"
        style={{ backgroundColor: accentStyle.accent }}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggle();
        }}
        className="frame-cut relative z-20 flex h-full cursor-pointer flex-col overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] text-left outline-none transition-colors hover:border-[var(--color-muted)]"
      >
        <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden bg-[var(--color-surface-alt)]">
          <div
            className="absolute inset-0 opacity-20 transition-opacity duration-500 group-hover:opacity-40"
            style={{ backgroundColor: accentStyle.dim }}
          />
          <span
            className="font-caprasimo text-[8rem] leading-none opacity-25 transition-transform duration-700 group-hover:scale-110"
            style={{ color: accentStyle.accent }}
          >
            {portraitInitial(scientist.name)}
          </span>
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[var(--color-surface)] to-transparent" />

          <div className="absolute left-4 top-4">
            <span
              className="font-gabarito rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md"
              style={{
                borderColor: accentStyle.accent,
                color: accentStyle.accent,
                backgroundColor: accentStyle.dim,
              }}
            >
              {scientist.archetype}
            </span>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <h3 className="font-caprasimo text-2xl md:text-3xl">{scientist.name}</h3>
          <p className="font-gabarito mt-2 text-sm text-[var(--tone-bark)]">{scientist.short}</p>
          <p className="font-mono mt-2 text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
            Base: {scientist.baseConcept}
          </p>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden sm:hidden"
              >
                <div className="mt-6 space-y-5 border-t border-[var(--color-border)] pt-6">
                  <p className="font-gabarito text-sm leading-relaxed text-[var(--tone-bark)]">
                    {scientist.detail}
                  </p>

                  <div className="space-y-4 pt-2">
                    {scientist.stats.map((stat, i) => (
                      <div key={stat.label}>
                        <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
                          <span>{stat.label}</span>
                          <span className="font-bold text-[var(--foreground)]">{stat.value}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-alt)]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${stat.value}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1 }}
                            className="h-full rounded-full"
                            style={{
                              backgroundColor: accentStyle.accent,
                              boxShadow: `0 0 10px ${accentStyle.glow}`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-4 flex items-center justify-center border-t border-[var(--color-border)] pt-4 opacity-50 transition-opacity duration-300 group-hover:opacity-100">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
              {isExpanded ? "Close Stats" : "View Stats"}
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute bottom-0 top-0 z-0 hidden overflow-hidden shadow-2xl sm:block ${getDrawerClass(index)}`}
          >
            <div className="frame-cut relative flex h-full w-[300px] flex-col border border-[var(--color-border)] bg-[var(--color-surface)] p-6 pl-8">
              <div className="mb-4">
                <span
                  className="font-gabarito rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase"
                  style={{
                    borderColor: accentStyle.accent,
                    color: accentStyle.accent,
                    backgroundColor: accentStyle.dim,
                  }}
                >
                  Stats and Intel
                </span>
              </div>
              <p className="font-gabarito text-sm leading-relaxed text-[var(--tone-bark)]">
                {scientist.detail}
              </p>

              <div className="mt-8 space-y-5">
                {scientist.stats.map((stat, i) => (
                  <div key={stat.label}>
                    <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
                      <span>{stat.label}</span>
                      <span className="font-bold text-[var(--foreground)]">{stat.value}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-alt)]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${stat.value}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: accentStyle.accent,
                          boxShadow: `0 0 10px ${accentStyle.glow}`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function Features() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <section
      id="roster"
      className="relative border-y border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 py-28 md:px-8"
    >
      <div className="pointer-events-none absolute inset-0 arena-grid opacity-30" />
      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-muted)]">
            Scientist Roster
          </p>
          <motion.h2
            initial={{ opacity: 0, y: 28, filter: "blur(10px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            className="font-caprasimo mt-4 text-4xl leading-tight md:text-6xl"
          >
            Choose your chibi scientist.
          </motion.h2>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_SCIENTISTS.map((scientist, index) => (
            <ScientistCard
              key={scientist.id}
              scientist={scientist}
              index={index}
              isExpanded={expandedId === scientist.id}
              onToggle={() => toggleExpand(scientist.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
