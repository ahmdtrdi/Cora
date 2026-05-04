"use client";

import type { ReactNode } from "react";

export type RoomStatusBadge =
  | "connected"
  | "matched"
  | "deposited"
  | "selecting"
  | "locked"
  | "auto_assigned"
  | "ready";

type PlayerRoomStatusProps = {
  label: string;
  subtitle?: string;
  badges: RoomStatusBadge[];
  rightSlot?: ReactNode;
};

const BADGE_STYLES: Record<RoomStatusBadge, { label: string; border: string; text: string; bg: string }> = {
  connected: {
    label: "Connected",
    border: "1px solid rgba(39,65,55,0.24)",
    text: "#274137",
    bg: "rgba(239,248,242,0.95)",
  },
  matched: {
    label: "Matched",
    border: "1px solid rgba(39,65,55,0.2)",
    text: "#274137",
    bg: "rgba(255,255,255,0.9)",
  },
  deposited: {
    label: "Deposited",
    border: "1px solid rgba(39,65,55,0.2)",
    text: "#275d34",
    bg: "rgba(236,248,228,0.95)",
  },
  selecting: {
    label: "Selecting",
    border: "1px solid rgba(186,105,49,0.28)",
    text: "#8f5a1d",
    bg: "rgba(255,246,230,0.95)",
  },
  locked: {
    label: "Locked",
    border: "1px solid rgba(39,65,55,0.24)",
    text: "#274137",
    bg: "rgba(244,250,246,0.95)",
  },
  auto_assigned: {
    label: "Auto-assigned",
    border: "1px solid rgba(186,105,49,0.28)",
    text: "#8f5a1d",
    bg: "rgba(255,244,236,0.95)",
  },
  ready: {
    label: "Ready",
    border: "1px solid rgba(39,65,55,0.24)",
    text: "#1f4d2b",
    bg: "rgba(230,247,234,0.95)",
  },
};

export function PlayerRoomStatus({
  label,
  subtitle,
  badges,
  rightSlot,
}: PlayerRoomStatusProps) {
  return (
    <div
      className="frame-cut p-3"
      style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.88)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-gabarito text-[11px] font-bold uppercase tracking-[0.16em] text-[#5e7768]">
            {label}
          </p>
          {subtitle ? (
            <p className="mt-1 font-gabarito text-xs text-[#5e7768]">{subtitle}</p>
          ) : null}
        </div>
        {rightSlot}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {badges.map((badge) => {
          const style = BADGE_STYLES[badge];
          return (
            <span
              key={badge}
              className="frame-cut frame-cut-sm px-2 py-1 font-gabarito text-[10px] font-bold uppercase tracking-wide"
              style={{ border: style.border, color: style.text, background: style.bg }}
            >
              {style.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
