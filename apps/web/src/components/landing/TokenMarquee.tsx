import { LANDING_TICKER_ITEMS } from "./content";
import { LANDING_TICKER_ACCENT_COLOR } from "./visuals";

export function TokenMarquee() {
  const loop = [
    ...LANDING_TICKER_ITEMS,
    ...LANDING_TICKER_ITEMS,
    ...LANDING_TICKER_ITEMS,
    ...LANDING_TICKER_ITEMS,
  ];

  return (
    <section className="relative z-10 w-full overflow-hidden border-y border-[var(--color-border)] bg-[var(--color-surface)]/85 py-4">
      <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-24 bg-gradient-to-r from-[var(--background)] to-transparent" />
      <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-24 bg-gradient-to-l from-[var(--background)] to-transparent" />

      <div className="animate-marquee flex w-max whitespace-nowrap font-mono text-xs uppercase">
        {loop.map((item, index) => {
          const color = LANDING_TICKER_ACCENT_COLOR[item.accent];

          return (
            <span
              key={`${item.label}-${index}`}
              className="mx-8 inline-flex items-center gap-2.5 text-[var(--color-muted)]"
            >
              <span
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ background: color, boxShadow: `0 0 6px ${color}` }}
              />
              <span className="font-gabarito font-bold text-[var(--foreground)]">{item.label}</span>
              <span className="font-gabarito opacity-70">{item.detail}</span>
            </span>
          );
        })}
      </div>
    </section>
  );
}
