"use client";

import type { ReactNode } from "react";
import type { DepositStatus } from "./depositTypes";
import { DEPOSIT_STATUS_META } from "./depositTypes";

type DepositStatusCardProps = {
  status: DepositStatus;
  helperText?: string;
  countdownSeconds?: number;
  signature?: string | null;
  walletSlot?: ReactNode;
  retrySlot?: ReactNode;
  cancelSlot?: ReactNode;
};

export function DepositStatusCard({
  status,
  helperText,
  countdownSeconds,
  signature,
  walletSlot,
  retrySlot,
  cancelSlot,
}: DepositStatusCardProps) {
  const meta = DEPOSIT_STATUS_META[status];
  const showCountdown = typeof countdownSeconds === "number" && countdownSeconds >= 0;

  return (
    <div className="frame-cut w-full max-w-xl p-4" style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.88)" }}>
      <p className="font-gabarito text-[11px] uppercase tracking-[0.16em] text-[#6b8274]">{meta.label}</p>
      <p className="mt-1 font-gabarito text-sm text-[#4f6759]">{helperText ?? meta.helper}</p>

      {showCountdown && (
        <p className="mt-3 font-caprasimo text-5xl text-[#ba6931]">{countdownSeconds}</p>
      )}

      {signature && (
        <p className="mt-3 break-all font-gabarito text-[11px] text-[#5e7768]">
          Signature: {signature}
        </p>
      )}

      {walletSlot && <div className="mt-3">{walletSlot}</div>}

      {(retrySlot || cancelSlot) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {retrySlot}
          {cancelSlot}
        </div>
      )}
    </div>
  );
}
