"use client";

import type { ReactNode } from "react";
import { CharacterCard } from "./CharacterCard";
import type {
  CharacterOption,
  CharacterSelectionState,
  CharacterSelectMode,
  OpponentCharacterStatus,
} from "./characterTypes";
import { CountdownBar } from "@/components/room/CountdownBar";
import { RoomStatusRail } from "@/components/room/RoomStatusRail";
import type { RoomStatusBadge } from "@/components/room/PlayerRoomStatus";

export type CharacterSelectProps = {
  mode?: CharacterSelectMode;
  characters: CharacterOption[];
  selectedCharacterId?: string;
  showHeading?: boolean;
  selectionState?: CharacterSelectionState;
  autoAssignedCharacterId?: string;
  neutralDefaultCharacterId?: string;
  locked?: boolean;
  disabled?: boolean;
  deadlineMs?: number;
  opponentStatus?: OpponentCharacterStatus;
  autoAssignLabel?: string;
  countdownSlot?: ReactNode;
  opponentStatusSlot?: ReactNode;
  roomStatusSlot?: ReactNode;
  onSelect: (characterId: string) => void;
};

function renderOpponentStatus(status: OpponentCharacterStatus, autoAssignLabel: string) {
  switch (status) {
    case "hidden":
      return "Opponent choice hidden";
    case "waiting":
      return "Waiting for opponent selection";
    case "picked":
      return "Opponent has selected";
    case "locked":
      return "Opponent selection locked";
    case "auto_assigned":
      return autoAssignLabel;
    default:
      return "Waiting for opponent selection";
  }
}

function getSelectionStateLine(selectionState: CharacterSelectionState) {
  switch (selectionState) {
    case "selected":
      return "Character selected. Lock will happen when phase advances.";
    case "locked":
      return "Character locked. Waiting for opponent lock.";
    case "auto_assigned":
      return "Auto-assigned balanced default because timer expired.";
    case "expired":
      return "Selection closed. Entering ready state.";
    default:
      return "Choose your character.";
  }
}

function getOpponentBadges(status?: OpponentCharacterStatus): RoomStatusBadge[] {
  if (!status || status === "hidden") return ["connected", "matched"];
  if (status === "waiting") return ["connected", "matched", "selecting"];
  if (status === "picked") return ["connected", "matched", "selecting"];
  if (status === "locked") return ["connected", "matched", "locked", "ready"];
  return ["connected", "matched", "auto_assigned", "ready"];
}

export function CharacterSelect({
  mode = "pre_queue",
  characters,
  selectedCharacterId,
  showHeading = true,
  selectionState = "idle",
  autoAssignedCharacterId,
  neutralDefaultCharacterId,
  locked = false,
  disabled = false,
  deadlineMs,
  opponentStatus,
  autoAssignLabel = "Opponent auto-assigned balanced default",
  countdownSlot,
  opponentStatusSlot,
  roomStatusSlot,
  onSelect,
}: CharacterSelectProps) {
  const showMeta = Boolean(countdownSlot || opponentStatusSlot || deadlineMs !== undefined || opponentStatus);
  const title = mode === "post_deposit" ? "Lock your character" : "Choose your character";
  const selectedCharacter = characters.find((character) => character.id === selectedCharacterId) ?? null;
  const autoAssignedCharacter = characters.find((character) => character.id === autoAssignedCharacterId) ?? null;
  const selectionLine = getSelectionStateLine(selectionState);
  const shouldShowAutoPickCopy = deadlineMs !== undefined && selectionState !== "expired";
  const canShowDefaultHint = mode === "post_deposit";
  const totalMs = 30_000;
  const remainingMs = deadlineMs ?? totalMs;

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
        <div className="mb-4 flex flex-col gap-2">
          {countdownSlot ? (
            countdownSlot
          ) : (
            deadlineMs !== undefined && (
              <CountdownBar
                totalMs={totalMs}
                remainingMs={remainingMs}
                label="Character selection timer"
              />
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

          {shouldShowAutoPickCopy && (
            <p className="font-gabarito text-xs text-[#5e7768]">
              Auto-pick if time expires.
            </p>
          )}
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2">
        <div
          className="frame-cut p-3"
          style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.88)" }}
        >
          <p className="font-gabarito text-[11px] font-bold uppercase tracking-[0.14em] text-[#5e7768]">
            Your Selection
          </p>
          <p className="mt-1 font-gabarito text-xs text-[#4f6759]">
            {selectedCharacter?.name ?? autoAssignedCharacter?.name ?? "No character selected yet."}
          </p>
          <p className="mt-1 font-gabarito text-xs text-[#5e7768]">{selectionLine}</p>
        </div>
        {roomStatusSlot ?? (
          <RoomStatusRail
            title="Selection Status"
            rows={[
              {
                id: "you",
                label: "You",
                subtitle: selectedCharacter?.name ?? autoAssignedCharacter?.name ?? "Waiting for pick",
                badges:
                  selectionState === "locked"
                    ? ["connected", "matched", "deposited", "selecting", "locked", "ready"]
                    : selectionState === "auto_assigned"
                      ? ["connected", "matched", "deposited", "auto_assigned", "ready"]
                      : selectionState === "selected"
                        ? ["connected", "matched", "deposited", "selecting"]
                        : ["connected", "matched", "deposited", "selecting"],
              },
              {
                id: "opponent",
                label: "Opponent",
                subtitle: opponentStatus === "waiting" ? "Choosing character" : "Selection state synced",
                badges: getOpponentBadges(opponentStatus),
              },
            ]}
          />
        )}
      </div>

      <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
        {characters.map((character, index) => (
          <CharacterCard
            key={character.id}
            character={character}
            selected={selectedCharacterId === character.id}
            autoAssigned={autoAssignedCharacterId === character.id}
            showNeutralDefault={canShowDefaultHint && neutralDefaultCharacterId === character.id}
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
