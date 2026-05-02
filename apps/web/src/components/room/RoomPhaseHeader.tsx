"use client";

import type { ReactNode } from "react";
import type { RoomPhase } from "./roomPhaseTypes";
import { ROOM_PHASE_LABELS } from "./roomPhaseTypes";

type RoomPhaseHeaderProps = {
  phase: RoomPhase;
  title?: ReactNode;
  subtitle?: ReactNode;
  statusSlot?: ReactNode;
  rightPanelSlot?: ReactNode;
};

export function RoomPhaseHeader({
  phase,
  title,
  subtitle,
  statusSlot,
  rightPanelSlot,
}: RoomPhaseHeaderProps) {
  const labels = ROOM_PHASE_LABELS[phase];

  return (
    <header className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-start">
      <div>
        <p className="font-gabarito text-[11px] uppercase tracking-[0.2em] text-[#6d8373]">
          {labels.eyebrow}
        </p>
        <h1 className="mt-2 font-caprasimo text-4xl leading-none text-[#1f2b24] md:text-5xl">
          {title ?? labels.title}
        </h1>
        <p className="mt-2 font-gabarito text-sm text-[#3c5044]">
          {subtitle ?? labels.subtitle}
        </p>
      </div>

      {(statusSlot || rightPanelSlot) && (
        <div className="flex flex-col items-start gap-2 md:items-end">
          {statusSlot}
          {rightPanelSlot}
        </div>
      )}
    </header>
  );
}
