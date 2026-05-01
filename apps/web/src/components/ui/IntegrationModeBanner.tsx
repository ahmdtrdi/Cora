"use client";

type IntegrationModeBannerProps = {
  depositMode: "mock" | "phantom";
  settlementMode: "mock" | "phantom";
  className?: string;
};

export function IntegrationModeBanner({
  depositMode,
  settlementMode,
  className,
}: IntegrationModeBannerProps) {
  return (
    <div className={className ?? "fixed left-4 top-4 z-[70] w-full max-w-sm md:left-6 md:top-6"}>
      <div
        className="frame-cut px-3 py-2"
        style={{ border: "1px solid rgba(186,105,49,0.3)", background: "rgba(255,250,242,0.95)" }}
      >
        <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[#8f5a1d]">
          Integration Mode
        </p>
        <p className="mt-1 font-gabarito text-xs text-[#73512d]">
          Deposit: {depositMode} - Settlement: {settlementMode}
        </p>
        <p className="mt-1 font-gabarito text-[11px] text-[#7c4a36]">
          Use this mode for integration test flow before full escrow wiring is finalized.
        </p>
      </div>
    </div>
  );
}
