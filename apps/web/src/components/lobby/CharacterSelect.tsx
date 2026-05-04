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
      phase="setup"
      title="Draft Your Scientist"
      subtitle="Choose the mind that will defend your base in the arena."
      statusSlot={
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="frame-cut frame-cut-sm px-3 py-2 font-gabarito text-xs font-semibold uppercase tracking-wide shadow-sm"
            style={{ border: `2px solid ${arena.frame}`, color: arena.frame, background: "var(--warm-bg)" }}
          >
            {arena.label}
          </span>
          <span
            className="frame-cut frame-cut-sm px-3 py-2 font-mono text-xs font-semibold tracking-wide text-[var(--tone-mint)] shadow-sm"
            style={{ border: "2px solid var(--tone-bark)", background: "var(--tone-forest)" }}
          >
            ${wagerUsd} {arena.token}
          </span>
          <span
            className="frame-cut frame-cut-sm px-3 py-2 font-mono text-xs font-semibold tracking-wide text-[var(--tone-cream)] shadow-sm"
            style={{ border: "2px solid var(--tone-bark)", background: "var(--tone-forest)" }}
          >
            {trimWallet(walletAddress)}
          </span>
        </div>
      }
      rightPanelSlot={
        <button
          type="button"
          onClick={onBack}
          className="btn-game btn-game-secondary px-4 py-2 text-[11px] shadow-sm"
        >
          Back
        </button>
      }
      footerSlot={
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onContinue}
            disabled={!selected}
            className={`btn-game btn-game-primary min-w-[180px] shadow-xl ${!selected ? "opacity-50 grayscale" : ""}`}
          >
            Enter Queue
          </button>
        </div>
      }
    >
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
    </RoomPhaseShell>
  );
}
