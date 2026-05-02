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
      title="Choose your character"
      subtitle="Pick one scientist before entering matchmaking."
      statusSlot={
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
      }
      rightPanelSlot={
        <button
          type="button"
          onClick={onBack}
          className="frame-cut frame-cut-sm px-3 py-2 font-gabarito text-xs font-semibold uppercase tracking-wide text-[#274137]"
          style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.82)" }}
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
            className="frame-cut frame-cut-sm min-w-[170px] px-5 py-3 font-gabarito text-sm font-extrabold uppercase tracking-wide"
            style={{
              border: selected ? `1px solid ${arena.frame}` : "1px solid rgba(39,65,55,0.2)",
              background: selected ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.65)",
              color: selected ? arena.frame : "rgba(39,65,55,0.45)",
            }}
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
