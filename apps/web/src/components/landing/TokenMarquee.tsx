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
    <section className="relative z-10 w-full overflow-hidden bg-[#6f3a28]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_50%,rgba(248,214,148,0.25),transparent_30%),radial-gradient(circle_at_88%_50%,rgba(244,180,100,0.20),transparent_32%)]" />

      <div className="relative mx-auto flex h-[88px] w-full items-center overflow-hidden border-y border-[rgba(248,214,148,0.12)]">
        <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-24 bg-gradient-to-r from-[#6f3a28] to-transparent" />
        <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-24 bg-gradient-to-l from-[#6f3a28] to-transparent" />

        <div className="flex w-full items-center">
          <div className="animate-marquee inline-flex w-max items-center whitespace-nowrap font-mono text-xs uppercase leading-none">
            {loop.map((item, index) => {
              const color = LANDING_TICKER_ACCENT_COLOR[item.accent];

              return (
                <span
                  key={`${item.label}-${index}`}
                  className="mx-8 inline-flex items-center gap-2.5 text-[#a08060]"
                >
                  <span
                    className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                  />
                  <span className="font-gabarito font-bold text-[#f4f0e6]">{item.label}</span>
                  <span className="font-gabarito opacity-70 text-[#c9b99a]">{item.detail}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}