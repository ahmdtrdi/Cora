"use client";

import { motion } from "framer-motion";
import type { Arena, Scientist } from "./LobbyScreen";

type CharacterSelectProps = {
  scientists: Scientist[];
  selected: Scientist | null;
  onSelect: (scientist: Scientist) => void;
  onBack: () => void;
  onContinue: () => void;
  arena: Arena;
  wagerUsd: string;
  walletAddress: string;
};

function trimWallet(address: string) {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

function ScientistCard({
  scientist,
  selected,
  onSelect,
  index,
}: {
  scientist: Scientist;
  selected: boolean;
  onSelect: () => void;
  index: number;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.06 }}
      className="frame-cut relative flex min-h-[250px] flex-col overflow-hidden px-4 pb-4 pt-3 text-left"
      style={{
        border: selected ? "1px solid #ba6931" : "1px solid rgba(39,65,55,0.18)",
        background: selected ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.8)",
        boxShadow: selected ? "0 10px 24px rgba(111,58,40,0.14)" : "none",
      }}
    >
      <div
        className="frame-cut frame-cut-sm mb-3 h-36 w-full"
        style={{ border: "1px solid rgba(39,65,55,0.18)", background: scientist.portraitBg }}
      >
        <div className="grid h-full place-items-center">
          <span className="font-caprasimo text-6xl opacity-40" style={{ color: scientist.accentColor }}>
            {scientist.initial}
          </span>
        </div>
      </div>

      <p className="font-caprasimo text-xl text-[#1f2b24]">{scientist.name}</p>
      <p className="mt-1 font-gabarito text-xs text-[#4c6156]">Base: {scientist.base}</p>

      <div className="mt-3 space-y-2">
        {scientist.stats.map((stat) => (
          <div key={stat.label}>
            <div className="mb-1 flex items-center justify-between font-gabarito text-[11px] text-[#5a7466]">
              <span>{stat.label}</span>
              <span>{stat.value}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-[rgba(39,65,55,0.14)]">
              <div className="h-full rounded-full" style={{ width: `${stat.value}%`, background: scientist.accentColor }} />
            </div>
          </div>
        ))}
      </div>
    </motion.button>
  );
}

export function CharacterSelect({
  scientists,
  selected,
  onSelect,
  onBack,
  onContinue,
  arena,
  wagerUsd,
  walletAddress,
}: CharacterSelectProps) {
  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col px-4 py-5 text-[#1f2b24] md:px-6 md:py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="frame-cut frame-cut-sm px-3 py-2 font-gabarito text-xs font-semibold uppercase tracking-wide text-[#274137]"
          style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.82)" }}
        >
          Back
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="frame-cut frame-cut-sm px-3 py-2 font-gabarito text-xs font-semibold uppercase tracking-wide"
            style={{ border: `1px solid ${arena.frame}`, color: arena.frame, background: "rgba(255,255,255,0.82)" }}
          >
            {arena.label}
          </span>
          <span
            className="frame-cut frame-cut-sm px-3 py-2 font-gabarito text-xs font-semibold uppercase tracking-wide text-[#6f3a28]"
            style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.82)" }}
          >
            ${wagerUsd} {arena.token}
          </span>
          <span
            className="frame-cut frame-cut-sm px-3 py-2 font-gabarito text-xs font-semibold text-[#274137]"
            style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.82)" }}
          >
            {trimWallet(walletAddress)}
          </span>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <div className="mb-4">
          <p className="font-gabarito text-[11px] uppercase tracking-[0.2em] text-[#6d8373]">Phase 2</p>
          <h1 className="mt-2 font-caprasimo text-4xl leading-none text-[#1f2b24] md:text-5xl">Choose your char</h1>
          <p className="mt-2 font-gabarito text-sm text-[#3c5044]">Pick one scientist before entering matchmaking.</p>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
          {scientists.map((scientist, index) => (
            <ScientistCard
              key={scientist.id}
              scientist={scientist}
              selected={selected?.id === scientist.id}
              onSelect={() => onSelect(scientist)}
              index={index}
            />
          ))}
        </div>
      </main>

      <footer className="mt-5 flex items-center justify-end">
        <button
          type="button"
          onClick={onContinue}
          disabled={!selected}
          className="frame-cut frame-cut-sm min-w-[170px] px-5 py-3 font-gabarito text-sm font-extrabold uppercase tracking-wide"
          style={{
            border: selected ? `1px solid ${arena.frame}` : "1px solid rgba(39,65,55,0.2)",
            background: selected ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.65)",
            color: selected ? arena.frame : "rgba(39,65,55,0.45)",
          }}
        >
          Enter Queue
        </button>
      </footer>
    </div>
  );
}

