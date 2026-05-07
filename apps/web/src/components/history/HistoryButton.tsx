"use client";

import Link from "next/link";

type HistoryButtonProps = {
  onClick?: () => void;
  href?: string;
  label?: string;
};

const SHARED_CLASSNAME =
  "frame-cut frame-cut-sm px-3 py-1.5 font-gabarito text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--tone-cream)] transition hover:-translate-y-0.5";
const SHARED_STYLE = {
  border: "1px solid rgba(248,214,148,0.42)",
  background: "linear-gradient(145deg, rgba(16,26,22,0.92), rgba(11,18,15,0.96))",
  boxShadow: "0 8px 14px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)",
} as const;

export function HistoryButton({ onClick, href, label = "History" }: HistoryButtonProps) {
  if (href) {
    return (
      <Link href={href} className={SHARED_CLASSNAME} style={SHARED_STYLE}>
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={SHARED_CLASSNAME} style={SHARED_STYLE}>
      {label}
    </button>
  );
}

