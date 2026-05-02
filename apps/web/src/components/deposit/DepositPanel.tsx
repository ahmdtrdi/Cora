"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { DepositStatusCard } from "./DepositStatusCard";
import type { DepositStatus } from "./depositTypes";

type DepositPanelProps = {
  title?: string;
  subtitle?: string;
  token: string;
  wagerUsd: string;
  status: DepositStatus;
  helperText?: string;
  countdownSeconds?: number;
  signature?: string | null;
  canPrimaryAction?: boolean;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  walletSlot?: ReactNode;
  retrySlot?: ReactNode;
  cancelSlot?: ReactNode;
  extraSlot?: ReactNode;
};

export function DepositPanel({
  title = "Sign deposit before battle",
  subtitle,
  token,
  wagerUsd,
  status,
  helperText,
  countdownSeconds,
  signature,
  canPrimaryAction = true,
  primaryActionLabel = "Sign Deposit",
  onPrimaryAction,
  walletSlot,
  retrySlot,
  cancelSlot,
  extraSlot,
}: DepositPanelProps) {
  return (
    <div className="mt-8 w-full text-center">
      <p className="font-gabarito text-xs uppercase tracking-[0.16em] text-[#6b8274]">
        ${wagerUsd} {token} - {title}
      </p>
      {subtitle && <p className="mt-1 font-gabarito text-xs text-[#5e7768]">{subtitle}</p>}

      <div className="mt-3 flex flex-col items-center gap-3">
        <DepositStatusCard
          status={status}
          helperText={helperText}
          countdownSeconds={countdownSeconds}
          signature={signature}
          walletSlot={walletSlot}
          retrySlot={retrySlot}
          cancelSlot={cancelSlot}
        />

        {onPrimaryAction && (
          <motion.button
            type="button"
            onClick={onPrimaryAction}
            disabled={!canPrimaryAction}
            className="frame-cut frame-cut-sm min-w-[210px] px-5 py-3 font-gabarito text-sm font-extrabold uppercase tracking-wide"
            style={{
              border: "1px solid rgba(39,65,55,0.24)",
              background: canPrimaryAction ? "rgba(255,255,255,0.92)" : "rgba(214,214,208,0.96)",
              color: canPrimaryAction ? "#274137" : "#5f695f",
              opacity: canPrimaryAction ? 1 : 0.95,
            }}
          >
            {primaryActionLabel}
          </motion.button>
        )}

        {extraSlot}
      </div>
    </div>
  );
}
