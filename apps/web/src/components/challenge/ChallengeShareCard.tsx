"use client";

type ShareNotice = {
  text: string;
  tone: "success" | "error";
};

type ChallengeShareCardProps = {
  title: string;
  challengerName: string;
  challengerAddress: string;
  arenaLabel: string;
  token: string;
  wagerUsd: string;
  challengeLink: string | null;
  description: string;
  statusLabel: string;
  actionCopyLabel?: string;
  actionSaveLabel?: string;
  actionShareLabel?: string;
  onCopy: () => void;
  onSaveJpg: () => void;
  onShareX: () => void;
  notice: ShareNotice | null;
};

function shortenAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

export function ChallengeShareCard({
  title,
  challengerName,
  challengerAddress,
  arenaLabel,
  token,
  wagerUsd,
  challengeLink,
  description,
  statusLabel,
  actionCopyLabel = "Copy Link",
  actionSaveLabel = "Save As JPG",
  actionShareLabel = "Share On X",
  onCopy,
  onSaveJpg,
  onShareX,
  notice,
}: ChallengeShareCardProps) {
  const qrSrc = challengeLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=${encodeURIComponent(challengeLink)}`
    : null;

  return (
    <div className="frame-cut frame-cut-sm p-3" style={{ border: "1px solid rgba(39,65,55,0.16)", background: "#fffdfa" }}>
      <p className="font-gabarito text-xs font-bold uppercase tracking-wide text-[#274137]">
        {title}
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
        <div className="frame-cut frame-cut-sm p-3" style={{ border: "1px solid rgba(39,65,55,0.14)", background: "rgba(255,255,255,0.92)" }}>
          <div className="grid h-24 w-24 place-items-center rounded-full border border-[rgba(39,65,55,0.25)] bg-[rgba(245,241,232,0.9)]">
            <p className="font-caprasimo text-3xl text-[#274137]">{challengerName.slice(0, 1).toUpperCase()}</p>
          </div>
          <p className="mt-3 font-caprasimo text-xl text-[#1f2b24]">{challengerName}</p>
          <p className="mt-1 font-gabarito text-xs text-[#4f6759]">{shortenAddress(challengerAddress)}</p>
          <p className="mt-2 inline-flex rounded-full border border-[rgba(39,65,55,0.18)] px-2 py-1 font-gabarito text-[10px] font-bold uppercase tracking-wide text-[#274137]">
            {statusLabel}
          </p>
          <p className="mt-2 font-gabarito text-xs text-[#5e7768]">{description}</p>
        </div>

        <div className="frame-cut frame-cut-sm p-3" style={{ border: "1px solid rgba(39,65,55,0.14)", background: "rgba(255,255,255,0.92)" }}>
          <div className="grid min-h-[160px] place-items-center rounded-md border border-[rgba(39,65,55,0.16)] bg-[#f5f1e8] p-2">
            {qrSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrSrc} alt="Challenge QR code" width={140} height={140} className="rounded-sm" />
            ) : (
              <p className="font-gabarito text-xs text-[#6d8373]">QR unavailable</p>
            )}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div className="frame-cut frame-cut-sm px-2 py-1 text-center" style={{ border: "1px solid rgba(39,65,55,0.14)", background: "#fffdfa" }}>
              <p className="font-gabarito text-[10px] uppercase tracking-wide text-[#6d8373]">Token</p>
              <p className="font-gabarito text-xs font-bold text-[#274137]">{token}</p>
            </div>
            <div className="frame-cut frame-cut-sm px-2 py-1 text-center" style={{ border: "1px solid rgba(39,65,55,0.14)", background: "#fffdfa" }}>
              <p className="font-gabarito text-[10px] uppercase tracking-wide text-[#6d8373]">Wager</p>
              <p className="font-gabarito text-xs font-bold text-[#274137]">${wagerUsd}</p>
            </div>
            <div className="frame-cut frame-cut-sm px-2 py-1 text-center" style={{ border: "1px solid rgba(39,65,55,0.14)", background: "#fffdfa" }}>
              <p className="font-gabarito text-[10px] uppercase tracking-wide text-[#6d8373]">Arena</p>
              <p className="font-gabarito text-xs font-bold text-[#274137]">{arenaLabel}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="frame-cut frame-cut-sm px-3 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
          style={{ border: "1px solid rgba(39,65,55,0.2)", color: "#274137", background: "rgba(255,255,255,0.9)" }}
        >
          {actionCopyLabel}
        </button>
        <button
          type="button"
          onClick={onSaveJpg}
          className="frame-cut frame-cut-sm px-3 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
          style={{ border: "1px solid rgba(39,65,55,0.2)", color: "#274137", background: "rgba(255,255,255,0.9)" }}
        >
          {actionSaveLabel}
        </button>
        <button
          type="button"
          onClick={onShareX}
          className="frame-cut frame-cut-sm px-3 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
          style={{ border: "1px solid rgba(39,65,55,0.2)", color: "#274137", background: "rgba(255,255,255,0.9)" }}
        >
          {actionShareLabel}
        </button>
      </div>

      {notice && (
        <p className="mt-2 font-gabarito text-xs" style={{ color: notice.tone === "success" ? "#2a5d43" : "#8a3f2b" }}>
          {notice.text}
        </p>
      )}

      {challengeLink && (
        <p className="mt-2 break-all font-gabarito text-[11px] text-[#5e7768]">
          {challengeLink}
        </p>
      )}
    </div>
  );
}
