const tokens = [
  { symbol: "SOL",  name: "Solana",       color: "var(--teal)" },
  { symbol: "USDC", name: "USD Coin",     color: "var(--color-muted)" },
  { symbol: "BONK", name: "Bonk",         color: "var(--amber)" },
  { symbol: "WIF",  name: "Dogwifhat",    color: "var(--color-muted)" },
  { symbol: "JUP",  name: "Jupiter",      color: "var(--teal)" },
  { symbol: "RAY",  name: "Raydium",      color: "var(--amber)" },
  { symbol: "PYTH", name: "Pyth Network", color: "var(--color-muted)" },
  { symbol: "JTO",  name: "Jito",         color: "var(--teal)" },
];

export function TokenMarquee() {
  const loop = [...tokens, ...tokens, ...tokens, ...tokens];

  return (
    <section className="relative z-10 w-full overflow-hidden border-y border-[var(--color-border)] bg-[var(--color-surface)]/80 py-4">
      <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-24 bg-gradient-to-r from-[var(--background)] to-transparent" />
      <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-24 bg-gradient-to-l from-[var(--background)] to-transparent" />

      <div className="animate-marquee flex w-max whitespace-nowrap font-mono text-xs uppercase">
        {loop.map((token, index) => (
          <span
            key={`${token.symbol}-${index}`}
            className="mx-8 inline-flex items-center gap-2.5 text-[var(--color-muted)]"
          >
            <span
              className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
              style={{ background: token.color, boxShadow: `0 0 6px ${token.color}` }}
            />
            <span className="font-bold text-[var(--foreground)]">${token.symbol}</span>
            <span className="opacity-60">{token.name}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
