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
    <div className="w-full pt-1 text-center">
      <p className="inline-flex items-center justify-center rounded-full border border-[rgba(248,214,148,0.36)] bg-[rgba(16,26,22,0.62)] px-3 py-1 font-gabarito text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--tone-cream)]">
        ${wagerUsd} {token} - {title}
      </p>
      {subtitle && <p className="mt-2 font-gabarito text-xs text-[rgba(244,240,230,0.82)]">{subtitle}</p>}

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
            className={`btn-game btn-game-primary min-w-[220px] px-8 py-3.5 text-base shadow-2xl transition-all ${
              canPrimaryAction ? "" : "cursor-not-allowed opacity-55 grayscale"
            }`}
          >
            {primaryActionLabel}
          </motion.button>
        )}

        {extraSlot}
      </div>
    </div>
  );
}
