"use client";

import type { ReactNode } from "react";
import { CharacterCard } from "./CharacterCard";
import type {
  CharacterOption,
  CharacterSelectMode,
  OpponentCharacterStatus,
} from "./characterTypes";

export type CharacterSelectProps = {
  mode?: CharacterSelectMode;
  characters: CharacterOption[];
  selectedCharacterId?: string;
  showHeading?: boolean;
  locked?: boolean;
  disabled?: boolean;
  deadlineMs?: number;
  opponentStatus?: OpponentCharacterStatus;
  autoAssignLabel?: string;
  countdownSlot?: ReactNode;
  opponentStatusSlot?: ReactNode;
  onSelect: (characterId: string) => void;
};

function formatCountdown(deadlineMs: number) {
  const totalSec = Math.max(0, Math.floor(deadlineMs / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function renderOpponentStatus(status: OpponentCharacterStatus, autoAssignLabel: string) {
  switch (status) {
    case "hidden":
      return "Opponent choice hidden";
    case "waiting":
      return "Waiting for opponent selection";
    case "picked":
      return "Opponent has selected";
    case "auto_assigned":
      return autoAssignLabel;
    default:
      return "Waiting for opponent selection";
  }
}

export function CharacterSelect({
  mode = "pre_queue",
  characters,
  selectedCharacterId,
  showHeading = true,
  locked = false,
  disabled = false,
  deadlineMs,
  opponentStatus,
  autoAssignLabel = "Opponent auto-assigned balanced default",
  countdownSlot,
  opponentStatusSlot,
  onSelect,
}: CharacterSelectProps) {
  const showMeta = Boolean(countdownSlot || opponentStatusSlot || deadlineMs !== undefined || opponentStatus);
  const title = mode === "post_deposit" ? "Lock your character" : "Choose your character";

  return (
    <section className="flex flex-1 flex-col">
      {showHeading && (
        <div className="mb-4">
          <p className="font-gabarito text-[11px] uppercase tracking-[0.2em] text-[#6d8373]">
            {mode === "post_deposit" ? "Character Lock" : "Character Select"}
          </p>
          <h1 className="mt-2 font-caprasimo text-4xl leading-none text-[#1f2b24] md:text-5xl">{title}</h1>
        </div>
      )}

      {showMeta && (
        <div className="mb-4 flex flex-wrap gap-2">
          {countdownSlot ? (
            countdownSlot
          ) : (
            deadlineMs !== undefined && (
              <span
                className="frame-cut frame-cut-sm px-3 py-2 font-gabarito text-xs font-semibold text-[#274137]"
                style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.82)" }}
              >
                Time left: {formatCountdown(deadlineMs)}
              </span>
            )
          )}

          {opponentStatusSlot ? (
            opponentStatusSlot
          ) : (
            opponentStatus && (
              <span
                className="frame-cut frame-cut-sm px-3 py-2 font-gabarito text-xs font-semibold text-[#4c6156]"
                style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.82)" }}
              >
                {renderOpponentStatus(opponentStatus, autoAssignLabel)}
              </span>
            )
          )}
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
        {characters.map((character, index) => (
          <CharacterCard
            key={character.id}
            character={character}
            selected={selectedCharacterId === character.id}
            disabled={disabled}
            locked={locked}
            index={index}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
