"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

type Stat = {
  label: string;
  value: number;
};

type CharacterCard = {
  id: string;
  title: string;
  short: string;
  detail: string;
  tag: string;
  accent: string;
  dim: string;
  stats: Stat[];
};

const characters: CharacterCard[] = [
  {
    id: "01",
    title: "The Fox",
    short: "Pattern Recognition & Agility",
    detail:
      "Excels in rapid logic puzzles and sequence predictions. Thrives on momentum and stringing correct answers together for combo damage.",
    tag: "Agility",
    accent: "var(--amber)",
    dim: "var(--amber-dim)",
    stats: [
      { label: "Logic", value: 85 },
      { label: "Memory", value: 45 },
      { label: "Focus", value: 60 },
      { label: "Speed", value: 95 },
    ],
  },
  {
    id: "02",
    title: "The Owl",
    short: "Memory & Deep Recall",
    detail:
      "Dominates in retention tasks and complex information matching. Features high base health and strong defensive healing abilities.",
    tag: "Wisdom",
    accent: "var(--teal)",
    dim: "var(--teal-dim)",
    stats: [
      { label: "Logic", value: 65 },
      { label: "Memory", value: 95 },
      { label: "Focus", value: 80 },
      { label: "Speed", value: 35 },
    ],
  },
  {
    id: "03",
    title: "The Raven",
    short: "Deduction & Logic",
    detail:
      "Master of elimination and logical breakdowns. Specializes in critical hits that trigger on complex multi-step problem solving.",
    tag: "Intellect",
    accent: "var(--amber)",
    dim: "var(--amber-dim)",
    stats: [
      { label: "Logic", value: 95 },
      { label: "Memory", value: 70 },
      { label: "Focus", value: 85 },
      { label: "Speed", value: 50 },
    ],
  },
  {
    id: "04",
    title: "The Lynx",
    short: "Focus & Reaction Time",
    detail:
      "Built for raw speed. Unmatched in rapid-fire time-attack rounds, delivering consistent fast damage at the cost of a lower health pool.",
    tag: "Reflex",
    accent: "var(--teal)",
    dim: "var(--teal-dim)",
    stats: [
      { label: "Logic", value: 55 },
      { label: "Memory", value: 50 },
      { label: "Focus", value: 90 },
      { label: "Speed", value: 85 },
    ],
  },
];

function getDrawerClass(index: number) {
  switch (index) {
    case 0:
      return "sm:left-full sm:-ml-4 lg:left-full lg:-ml-4";
    case 1:
      return "sm:right-full sm:-mr-4 lg:left-full lg:right-auto lg:-ml-4 lg:-mr-0";
    case 2:
      return "sm:left-full sm:-ml-4 lg:right-full lg:left-auto lg:-mr-4 lg:-ml-0";
    case 3:
      return "sm:right-full sm:-mr-4 lg:right-full lg:-mr-4";
    default:
      return "";
  }
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
            Arena Roster
          </p>
          <motion.h2
            initial={{ opacity: 0, y: 28, filter: "blur(10px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 text-4xl font-black leading-tight md:text-6xl"
          >
            Choose your cognitive champion.
          </motion.h2>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {characters.map((char, index) => {
            const isExpanded = expandedId === char.id;

            return (
              <motion.div
                key={char.id}
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
                {/* Ambient Glow on Hover */}
                <div
                  className="absolute -inset-0.5 rounded-2xl opacity-0 blur-xl transition duration-500 group-hover:opacity-40"
                  style={{ backgroundColor: char.accent }}
                />

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(char.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") toggleExpand(char.id);
                  }}
                  className="frame-cut relative z-20 flex h-full cursor-pointer flex-col overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] text-left outline-none transition-colors hover:border-[var(--color-muted)]"
                >
                  {/* Portrait Area */}
                  <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden bg-[var(--color-surface-alt)]">
                    <div
                      className="absolute inset-0 opacity-20 transition-opacity duration-500 group-hover:opacity-40"
                      style={{ backgroundColor: char.dim }}
                    />
                    <span
                      className="text-[8rem] font-black leading-none opacity-20 transition-transform duration-700 group-hover:scale-110"
                      style={{ color: char.accent }}
                    >
                      {char.title.split(" ")[1].charAt(0)}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[var(--color-surface)] to-transparent" />

                    <div className="absolute left-4 top-4">
                      <span
                        className="rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase backdrop-blur-md"
                        style={{
                          borderColor: char.accent,
                          color: char.accent,
                          backgroundColor: `${char.dim}80`,
                        }}
                      >
                        {char.tag}
                      </span>
                    </div>
                  </div>

                  {/* Always Visible Info */}
                  <div className="p-5 md:p-6">
                    <h3 className="text-2xl font-black md:text-3xl">{char.title}</h3>
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
                      {char.short}
                    </p>

                    {/* Mobile Only: Vertical Expand */}
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
                            <p className="text-sm leading-relaxed text-[var(--color-muted)]">
                              {char.detail}
                            </p>

                            <div className="space-y-4 pt-2">
                              {char.stats.map((stat, i) => (
                                <div key={stat.label}>
                                  <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
                                    <span>{stat.label}</span>
                                    <span className="font-bold text-[var(--foreground)]">
                                      {stat.value}
                                    </span>
                                  </div>
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-alt)]">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${stat.value}%` }}
                                      transition={{ duration: 0.8, delay: i * 0.1 }}
                                      className="h-full rounded-full"
                                      style={{
                                        backgroundColor: char.accent,
                                        boxShadow: `0 0 10px ${char.accent}`,
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

                    {/* Expand Hint */}
                    <div className="mt-4 flex items-center justify-center border-t border-[var(--color-border)] pt-4 opacity-50 transition-opacity duration-300 group-hover:opacity-100">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
                        {isExpanded ? "Close Stats" : "View Stats"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tablet/Desktop Side Sliding Drawer */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 300, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      className={`absolute top-0 bottom-0 z-0 hidden overflow-hidden shadow-2xl sm:block ${getDrawerClass(index)}`}
                    >
                      {/* Fixed inner wrapper prevents content reflow during width animation */}
                      <div className="frame-cut relative flex h-full w-[300px] flex-col border border-[var(--color-border)] bg-[var(--color-surface)] p-6 pl-8">
                        <div className="mb-4">
                          <span
                            className="rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase"
                            style={{
                              borderColor: char.accent,
                              color: char.accent,
                              backgroundColor: char.dim,
                            }}
                          >
                            Stats & Intel
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-[var(--color-muted)]">
                          {char.detail}
                        </p>

                        <div className="mt-8 space-y-5">
                          {char.stats.map((stat, i) => (
                            <div key={stat.label}>
                              <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
                                <span>{stat.label}</span>
                                <span className="font-bold text-[var(--foreground)]">
                                  {stat.value}
                                </span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-alt)]">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${stat.value}%` }}
                                  transition={{ duration: 0.8, delay: i * 0.1 }}
                                  className="h-full rounded-full"
                                  style={{
                                    backgroundColor: char.accent,
                                    boxShadow: `0 0 10px ${char.accent}`,
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
          })}
        </div>
      </div>
    </section>
  );
}
