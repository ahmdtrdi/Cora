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
    <div className={className ?? "fixed left-4 bottom-4 z-[70] md:left-6 md:bottom-6"}>
      <div
        className="flex items-center gap-2 rounded-full px-3 py-1.5 shadow-sm backdrop-blur-md transition-opacity hover:opacity-100 opacity-60"
        style={{ border: "1px solid var(--tone-bark)", background: "var(--warm-surface)" }}
      >
        <div className="h-2 w-2 rounded-full bg-[var(--tone-clay)] animate-pulse" />
        <p className="font-gabarito text-[10px] font-bold uppercase tracking-wider text-[var(--tone-bark)]">
          Dev: {depositMode}/{settlementMode}
        </p>
      </div>
    </div>
  );
}
