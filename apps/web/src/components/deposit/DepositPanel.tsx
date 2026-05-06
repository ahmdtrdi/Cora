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
            className={`frame-cut frame-cut-sm min-w-[210px] px-5 py-3 font-gabarito text-sm font-extrabold uppercase tracking-wide transition ${
              canPrimaryAction ? "hover:-translate-y-0.5" : ""
            }`}
            style={{
              border: canPrimaryAction
                ? "1px solid rgba(248,214,148,0.5)"
                : "1px solid rgba(248,214,148,0.2)",
              background: canPrimaryAction
                ? "linear-gradient(145deg, rgba(122,69,41,0.96), rgba(79,43,25,0.96))"
                : "linear-gradient(145deg, rgba(28,44,36,0.96), rgba(18,30,24,0.96))",
              color: canPrimaryAction ? "var(--tone-cream)" : "rgba(244,240,230,0.68)",
              boxShadow: canPrimaryAction
                ? "0 10px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.16)"
                : "0 6px 12px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.08)",
              opacity: canPrimaryAction ? 1 : 0.76,
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
