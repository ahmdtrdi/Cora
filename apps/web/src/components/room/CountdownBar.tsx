"use client";

type CountdownBarProps = {
  totalMs: number;
  remainingMs: number;
  label?: string;
};

function formatMs(ms: number) {
  const safe = Math.max(0, ms);
  const totalSec = Math.floor(safe / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function CountdownBar({
  totalMs,
  remainingMs,
  label = "Selection timer",
}: CountdownBarProps) {
  const safeTotal = Math.max(1, totalMs);
  const safeRemaining = Math.max(0, remainingMs);
  const ratio = Math.min(100, Math.max(0, (safeRemaining / safeTotal) * 100));

  return (
    <div
      className="frame-cut frame-cut-sm w-full min-w-[220px] max-w-[360px] px-3 py-2"
      style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,255,255,0.9)" }}
    >
      <div className="mb-1 flex items-center justify-between">
        <p className="font-gabarito text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5e7768]">
          {label}
        </p>
        <p className="font-gabarito text-xs font-bold text-[#274137]">
          {formatMs(safeRemaining)}
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(39,65,55,0.14)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#ba6931,#d9a85b)] transition-[width] duration-500"
          style={{ width: `${ratio}%` }}
        />
      </div>
    </div>
  );
}
