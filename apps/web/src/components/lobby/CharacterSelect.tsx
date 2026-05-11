"use client";

import type { Arena, Scientist } from "./LobbyScreen";
import { CharacterSelect as CharacterSelectPanel } from "@/components/character/CharacterSelect";
import type { CharacterOption } from "@/components/character/characterTypes";
import { RoomPhaseShell } from "@/components/room/RoomPhaseShell";

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
  const characters: CharacterOption[] = scientists.map((scientist) => ({
    ...scientist,
  }));

  return (
    <RoomPhaseShell
      withTransition={false}
      className="min-h-[100svh] overflow-x-hidden overflow-y-auto pb-3 pt-5 md:h-[100svh] md:overflow-hidden md:pb-4 md:pt-6"
      phase="setup"
      hideTitleBlock={true}
      statusSlot={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span
            className="frame-cut frame-cut-sm px-3 py-1.5 font-gabarito text-[11px] font-semibold uppercase tracking-wide shadow-sm"
            style={{ border: `2px solid ${arena.frame}`, color: arena.frame, background: "var(--warm-bg)" }}
          >
            {arena.label}
          </span>
          <span
            className="frame-cut frame-cut-sm px-3 py-1.5 font-mono text-[11px] font-semibold tracking-wide text-[var(--tone-mint)] shadow-sm"
            style={{ border: "2px solid var(--tone-bark)", background: "var(--tone-forest)" }}
          >
            ${wagerUsd} {arena.token}
          </span>
          <span
            className="frame-cut frame-cut-sm px-3 py-1.5 font-mono text-[11px] font-semibold tracking-wide text-[var(--tone-cream)] shadow-sm"
            style={{ border: "2px solid var(--tone-bark)", background: "var(--tone-forest)" }}
          >
            {trimWallet(walletAddress)}
          </span>
        </div>
      }
    >
      <div className="flex flex-col">
        {/* Main header row */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 md:mb-10">
          <div>
            <p className="font-gabarito text-[11px] font-bold uppercase tracking-[0.2em] text-[#f8d694]">
              Setup
            </p>
            <h1 className="mt-3 font-caprasimo text-[2rem] leading-none text-[#fff8ea] drop-shadow-[0_5px_10px_rgba(0,0,0,0.45)] md:text-[2.6rem]">
              Choose Your Scientist
            </h1>
            <p className="mt-3 max-w-2xl font-gabarito text-[14px] text-[rgba(244,240,230,0.9)] leading-relaxed">
              Choose the mind that will defend your base in the arena.
            </p>
          </div>
          <div className="shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="btn-game btn-game-secondary px-4 py-2 text-[11px] shadow-sm"
            >
              Back
            </button>
          </div>
        </div>
        <CharacterSelectPanel
          mode="pre_queue"
          characters={characters}
          selectedCharacterId={selected?.id}
          showHeading={false}
          showLabels={false}
          onSelect={(characterId) => {
            const next = scientists.find((scientist) => scientist.id === characterId);
            if (!next) return;
            onSelect(next);
          }}
        />
        <div className="mt-6 flex items-center justify-end md:mt-8">
          <button
            type="button"
            onClick={onContinue}
            disabled={!selected}
            className={`btn-game btn-game-primary min-w-[172px] px-5 py-2 text-xs shadow-xl ${!selected ? "opacity-50 grayscale" : ""}`}
          >
            Enter Queue
          </button>
        </div>
      </div>
    </RoomPhaseShell>
  );
}
