"use client";

import { motion } from "framer-motion";
import type { CharacterOption } from "./characterTypes";

type CharacterCardProps = {
  character: CharacterOption;
  selected: boolean;
  disabled?: boolean;
  locked?: boolean;
  index: number;
  onSelect: (characterId: string) => void;
};

export function CharacterCard({
  character,
  selected,
  disabled = false,
  locked = false,
  index,
  onSelect,
}: CharacterCardProps) {
  const isInteractive = !disabled && !locked;

  return (
    <motion.button
      type="button"
      onClick={() => {
        if (isInteractive) onSelect(character.id);
      }}
      disabled={!isInteractive}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.06 }}
      className="frame-cut relative flex min-h-[250px] flex-col overflow-hidden px-4 pb-4 pt-3 text-left"
      style={{
        border: selected ? "1px solid #ba6931" : "1px solid rgba(39,65,55,0.18)",
        background: selected ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.8)",
        boxShadow: selected ? "0 10px 24px rgba(111,58,40,0.14)" : "none",
        opacity: disabled && !selected ? 0.62 : 1,
        cursor: isInteractive ? "pointer" : "not-allowed",
      }}
      aria-pressed={selected}
      aria-disabled={!isInteractive}
    >
      <div
        className="frame-cut frame-cut-sm mb-3 h-36 w-full"
        style={{ border: "1px solid rgba(39,65,55,0.18)", background: character.portraitBg }}
      >
        <div className="grid h-full place-items-center">
          <span className="font-caprasimo text-6xl opacity-40" style={{ color: character.accentColor }}>
            {character.initial}
          </span>
        </div>
      </div>

      <p className="font-caprasimo text-xl text-[#1f2b24]">{character.name}</p>
      <p className="mt-1 font-gabarito text-xs text-[#4c6156]">Base: {character.base}</p>

      <div className="mt-3 space-y-2">
        {character.stats.map((stat) => (
          <div key={stat.label}>
            <div className="mb-1 flex items-center justify-between font-gabarito text-[11px] text-[#5a7466]">
              <span>{stat.label}</span>
              <span>{stat.value}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-[rgba(39,65,55,0.14)]">
              <div className="h-full rounded-full" style={{ width: `${stat.value}%`, background: character.accentColor }} />
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <span
          className="frame-cut frame-cut-sm absolute right-3 top-3 px-2 py-1 font-gabarito text-[10px] font-bold uppercase tracking-wide text-[#6f3a28]"
          style={{ border: "1px solid rgba(186,105,49,0.35)", background: "rgba(255,248,236,0.95)" }}
        >
          Selected
        </span>
      )}
      {locked && selected && (
        <span
          className="frame-cut frame-cut-sm absolute bottom-3 right-3 px-2 py-1 font-gabarito text-[10px] font-bold uppercase tracking-wide text-[#274137]"
          style={{ border: "1px solid rgba(39,65,55,0.28)", background: "rgba(244,250,246,0.95)" }}
        >
          Locked
        </span>
      )}
    </motion.button>
  );
}
