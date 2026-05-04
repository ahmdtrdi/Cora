"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { LANDING_SCIENTISTS, type ScientistProfile } from "./content";
import { getLandingAccentStyle } from "./visuals";

const RARITY_LABELS = ["Legendary", "Epic", "Rare"] as const;

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
  const isPrimary = scientist.accent === "primary";
  const rarity = RARITY_LABELS[index] ?? "Rare";

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95, filter: "blur(12px)" }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ type: "spring", stiffness: 95, damping: 20, mass: 0.85, delay: index * 0.1 }}
      className={`group relative ${isExpanded ? "z-50" : "z-10 hover:z-20"}`}
    >
      {/* hover glow */}
      <div className="absolute -inset-1 rounded-[24px] opacity-0 blur-xl transition duration-500 group-hover:opacity-30" style={{ backgroundColor: accentStyle.accent }} />

      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggle(); }}
        className="game-card relative z-20 flex h-full cursor-pointer flex-col overflow-hidden text-left outline-none"
      >
        {/* portrait area */}
        <div className="relative flex aspect-[4/5] w-full flex-col items-center justify-center overflow-hidden bg-[var(--tone-ecru)]">
          {/* colored background wash */}
          <div className="absolute inset-0 opacity-20" style={{ background: isPrimary ? "radial-gradient(circle at 50% 40%, rgba(186,105,49,0.3), transparent 70%)" : "radial-gradient(circle at 50% 40%, rgba(60,92,95,0.3), transparent 70%)" }} />

          {/* chibi silhouette placeholder */}
          <div className="relative mb-3 flex flex-col items-center">
            {/* head circle */}
            <div
              className="grid h-20 w-20 place-items-center rounded-full border-[3px] shadow-md"
              style={{ borderColor: isPrimary ? "var(--tone-clay)" : "var(--tone-teal)", background: isPrimary ? "rgba(186,105,49,0.1)" : "rgba(60,92,95,0.1)" }}
            >
              <span className="text-3xl">{scientist.emoji}</span>
            </div>
            {/* coat body shape */}
            <div
              className="-mt-2 h-12 w-16 rounded-b-2xl border-x-[3px] border-b-[3px] opacity-60"
              style={{ borderColor: isPrimary ? "var(--tone-clay)" : "var(--tone-teal)", background: isPrimary ? "rgba(186,105,49,0.08)" : "rgba(60,92,95,0.08)" }}
            />
          </div>

          {/* base object */}
          <div className="text-2xl opacity-50">{scientist.baseEmoji}</div>
          <p className="font-mono mt-1 text-[9px] uppercase tracking-widest text-[var(--warm-muted)]">Base: {scientist.baseConcept}</p>

          {/* rarity badge */}
          <div className="absolute right-3 top-3">
            <span
              className="font-gabarito rounded-lg border-2 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
              style={{ borderColor: isPrimary ? "var(--tone-clay)" : "var(--tone-teal)", color: isPrimary ? "var(--tone-clay)" : "var(--tone-teal)", background: isPrimary ? "rgba(186,105,49,0.12)" : "rgba(60,92,95,0.12)" }}
            >
              {rarity}
            </span>
          </div>

          {/* archetype badge */}
          <div className="absolute left-3 top-3">
            <span
              className="font-gabarito rounded-lg border-2 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
              style={{ borderColor: isPrimary ? "var(--tone-clay)" : "var(--tone-teal)", color: "#fffaf0", background: isPrimary ? "var(--tone-clay)" : "var(--tone-teal)" }}
            >
              {scientist.archetype}
            </span>
          </div>

          {/* HP bar at bottom of portrait */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-[var(--warm-muted)]">HP</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(111,58,40,0.12)]">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: "82%", background: "linear-gradient(90deg, #9db496, #cbe3c1)" }} />
              </div>
            </div>
          </div>
        </div>

        {/* card body */}
        <div className="p-5 md:p-6">
          <h3 className="font-caprasimo text-2xl text-[var(--warm-text)] md:text-3xl">{scientist.name}</h3>
          <p className="font-gabarito mt-2 text-sm text-[var(--warm-muted)]">{scientist.short}</p>

          {/* mobile expand */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden sm:hidden"
              >
                <div className="mt-6 space-y-5 border-t border-[var(--warm-border)] pt-6">
                  <p className="font-gabarito text-sm leading-relaxed text-[var(--warm-muted)]">{scientist.detail}</p>
                  <div className="space-y-4 pt-2">
                    {scientist.stats.map((stat, i) => (
                      <div key={stat.label}>
                        <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-[var(--warm-muted)]">
                          <span>{stat.label}</span>
                          <span className="font-bold text-[var(--warm-text)]">{stat.value}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(111,58,40,0.1)]">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${stat.value}%` }} transition={{ duration: 0.8, delay: i * 0.1 }} className="h-full rounded-full" style={{ backgroundColor: accentStyle.accent }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-4 flex items-center justify-center border-t border-[var(--warm-border)] pt-4 opacity-50 transition-opacity duration-300 group-hover:opacity-100">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--warm-muted)]">
              {isExpanded ? "Close Stats" : "View Stats"}
            </span>
          </div>
        </div>
      </div>

      {/* desktop drawer */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute bottom-0 top-0 z-0 hidden overflow-hidden shadow-2xl sm:block ${index === 1 ? "sm:right-full sm:-mr-4 lg:left-full lg:right-auto lg:-ml-4 lg:-mr-0" : index === 2 ? "sm:left-full sm:-ml-4 lg:right-full lg:left-auto lg:-mr-4 lg:-ml-0" : "sm:left-full sm:-ml-4 lg:left-full lg:-ml-4"}`}
          >
            <div className="relative flex h-full w-[300px] flex-col overflow-hidden rounded-2xl border-[3px] border-[var(--tone-bark)] bg-[var(--warm-surface)] p-6 pl-8">
              <div className="mb-4">
                <span className="font-gabarito rounded-lg border-2 px-2.5 py-1 text-[10px] font-bold uppercase" style={{ borderColor: accentStyle.accent, color: accentStyle.accent, backgroundColor: isPrimary ? "rgba(186,105,49,0.1)" : "rgba(60,92,95,0.1)" }}>
                  Stats and Intel
                </span>
              </div>
              <p className="font-gabarito text-sm leading-relaxed text-[var(--warm-muted)]">{scientist.detail}</p>
              <div className="mt-8 space-y-5">
                {scientist.stats.map((stat, i) => (
                  <div key={stat.label}>
                    <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-[var(--warm-muted)]">
                      <span>{stat.label}</span>
                      <span className="font-bold text-[var(--warm-text)]">{stat.value}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(111,58,40,0.1)]">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${stat.value}%` }} transition={{ duration: 0.8, delay: i * 0.1 }} className="h-full rounded-full" style={{ backgroundColor: accentStyle.accent }} />
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
  const toggleExpand = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  return (
    <section
      id="roster"
      className="paper-grain relative overflow-hidden px-4 py-28 md:px-8"
      style={{ background: "linear-gradient(180deg, var(--warm-bg) 0%, #f5edd8 100%)" }}
    >
      {/* decorative dots */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle, var(--tone-bark) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="font-gabarito text-xs font-bold uppercase tracking-widest text-[var(--warm-muted)]">
            Meet the Minds
          </p>
          <motion.h2
            initial={{ opacity: 0, y: 28, filter: "blur(10px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            className="font-caprasimo mt-4 text-4xl leading-tight text-[var(--warm-text)] md:text-6xl"
          >
            Every mind has a strategy.{" "}
            <span className="text-[var(--tone-clay)]">Every base has a weakness.</span>
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
