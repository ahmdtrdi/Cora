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
    stats: [...scientist.stats],
  }));

  return (
    <RoomPhaseShell
      withTransition={false}
      className="h-[100svh] overflow-hidden pb-3 pt-5 md:pb-4 md:pt-6"
      phase="setup"
      preHeadingSlot={
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(248,214,148,0.42)] bg-[rgba(16,26,22,0.45)] px-2.5 py-1 font-gabarito text-[11px] font-semibold text-[#f4f0e6] transition-colors hover:bg-[rgba(16,26,22,0.62)]"
        >
          <span aria-hidden="true">←</span>
          Back
        </button>
      }
      title="Choose Your Scientist"
      subtitle="Choose the mind that will defend your base in the arena."
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
      footerSlot={
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onContinue}
            disabled={!selected}
            className={`btn-game btn-game-primary min-w-[172px] px-5 py-2 text-xs shadow-xl ${!selected ? "opacity-50 grayscale" : ""}`}
          >
            Enter Queue
          </button>
        </div>
      }
    >
      <div className="mt-2 md:mt-3">
        <CharacterSelectPanel
          mode="pre_queue"
          characters={characters}
          selectedCharacterId={selected?.id}
          showHeading={false}
          onSelect={(characterId) => {
            const next = scientists.find((scientist) => scientist.id === characterId);
            if (!next) return;
            onSelect(next);
          }}
        />
      </div>
    </RoomPhaseShell>
  );
}
