import type { CSSProperties } from "react";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChallengeShareCard } from "@/components/challenge/ChallengeShareCard";

type SettlementPayload = {
  matchId: string;
  serverPublicKey: string;
  settlementSignature: string;
} | null;

type ShareNotice = {
  text: string;
  tone: "success" | "error";
} | null;

type SettlementEmojiMood = {
  player: "confident" | "hurt";
  opponent: "confident" | "hurt";
} | null;

type SettlementExpressionSrc = {
  player: string | null;
  opponent: string | null;
} | null;

type SettlementOutcomeKind =
  | "win"
  | "lose"
  | "opponent_surrender"
  | "player_surrender"
  | "draw"
  | "invalidated"
  | "cancelled"
  | "pending";

type BattleScreenOverlaysProps = {
  showRoomGateModal: boolean;
  roomGateTitle: string;
  roomGateMessage: string;
  hasSocketIssue: boolean;
  onReconnect: () => void;
  cleanLobbyHref: string;
  onReturnToLobby: () => void;
  showDisconnectedOverlay: boolean;
  pendingSurrenderAfterReconnect: boolean;
  canSurrenderByState: boolean;
  onConfirmSurrender: () => void;
  isMatchComplete: boolean;
  surrenderModalOpen: boolean;
  canSurrenderMatch: boolean;
  onCloseSurrenderModal: () => void;
  settlementText: string;
  settlementSubtitle: string;
  settlementOutcomeKind: SettlementOutcomeKind;
  settlementEmojiMood: SettlementEmojiMood;
  settlementExpressionSrc: SettlementExpressionSrc;
  settlementStatus: string;
  settlementStatusStyle: CSSProperties;
  winnerLineText: string | null;
  playerRoundsWon: number;
  opponentRoundsWon: number;
  correctCount: number;
  timeoutCount: number;
  wrongCount: number;
  settlementDetailsOpen: boolean;
  onToggleSettlementDetails: () => void;
  settlementPayload: SettlementPayload;
  onOpenShareModal: () => void;
  shareModalOpen: boolean;
  onCloseShareModal: () => void;
  address: string;
  arenaLabel: string;
  arenaToken: string;
  wagerUsd: string;
  challengeLink: string | null;
  challengeDescription: string;
  challengeStatusLabel: string;
  onCopyChallengeLink: () => Promise<void>;
  onSaveChallengeJpg: () => Promise<void>;
  onShareChallengeToX: () => Promise<void>;
  shareNotice: ShareNotice;
};

export function BattleScreenOverlays({
  showRoomGateModal,
  roomGateTitle,
  roomGateMessage,
  hasSocketIssue,
  onReconnect,
  cleanLobbyHref,
  onReturnToLobby,
  showDisconnectedOverlay,
  pendingSurrenderAfterReconnect,
  canSurrenderByState,
  onConfirmSurrender,
  isMatchComplete,
  surrenderModalOpen,
  canSurrenderMatch,
  onCloseSurrenderModal,
  settlementText,
  settlementSubtitle,
  settlementOutcomeKind,
  settlementEmojiMood,
  settlementExpressionSrc,
  settlementStatus,
  settlementStatusStyle,
  winnerLineText,
  playerRoundsWon,
  opponentRoundsWon,
  correctCount,
  timeoutCount,
  wrongCount,
  settlementDetailsOpen,
  onToggleSettlementDetails,
  settlementPayload,
  onOpenShareModal,
  shareModalOpen,
  onCloseShareModal,
  address,
  arenaLabel,
  arenaToken,
  wagerUsd,
  challengeLink,
  challengeDescription,
  challengeStatusLabel,
  onCopyChallengeLink,
  onSaveChallengeJpg,
  onShareChallengeToX,
  shareNotice,
}: BattleScreenOverlaysProps) {
  const [failedExpressionSprites, setFailedExpressionSprites] = useState<Record<string, true>>({});
  const parsedWagerUsd = Number.parseFloat(wagerUsd);
  const wagerUsdDisplay =
    Number.isFinite(parsedWagerUsd) && parsedWagerUsd > 0
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(parsedWagerUsd)
      : null;
  const tokenLabel = arenaToken?.trim() ? arenaToken.toUpperCase() : "TOKEN";

  const payoutHighlight =
    settlementOutcomeKind === "win" || settlementOutcomeKind === "opponent_surrender"
      ? wagerUsdDisplay
        ? `You win the ${tokenLabel} wager (about ${wagerUsdDisplay} at entry).`
        : `You win the ${tokenLabel} wager.`
      : settlementOutcomeKind === "lose"
      ? "No winner payout was awarded to you for this match."
      : settlementOutcomeKind === "player_surrender"
      ? wagerUsdDisplay
        ? `You surrendered and forfeited your wager (about ${wagerUsdDisplay} at entry).`
        : "You surrendered and forfeited your wager."
      : settlementOutcomeKind === "draw"
      ? "Draw result: no winner payout."
      : settlementOutcomeKind === "invalidated"
      ? "Match invalidated: payout is pending the invalidation outcome."
      : settlementOutcomeKind === "cancelled"
      ? "Room cancelled before a final winner payout."
      : "Settlement is still being finalized.";

  const isWinPayoutHighlight = settlementOutcomeKind === "win" || settlementOutcomeKind === "opponent_surrender";

  return (
    <>
      {showRoomGateModal && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[rgba(2,6,5,0.62)] p-4 backdrop-blur-[1px]">
          <div
            className="frame-cut w-full max-w-md p-4 md:p-5"
            style={{ border: "1px solid rgba(248,214,148,0.38)", background: "rgba(13,24,20,0.94)" }}
          >
            <p className="font-caprasimo text-3xl text-[var(--tone-cream)] md:text-4xl">{roomGateTitle}</p>
            <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.84)]">{roomGateMessage}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {hasSocketIssue && (
                <button
                  type="button"
                  onClick={onReconnect}
                  className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
                  style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
                >
                  Rejoin Room
                </button>
              )}
              <Link
                href={cleanLobbyHref}
                onClick={onReturnToLobby}
                className="frame-cut frame-cut-sm px-3 py-1 font-gabarito text-[11px] font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
              >
                Return To Lobby
              </Link>
            </div>
          </div>
        </div>
      )}

      {showDisconnectedOverlay && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[rgba(2,6,5,0.82)] p-4 backdrop-blur-[1px]">
          <div
            className="frame-cut w-full max-w-lg p-5 md:p-6"
            style={{ border: "1px solid rgba(248,214,148,0.42)", background: "rgba(13,24,20,0.96)" }}
          >
            <p className="font-caprasimo text-3xl text-[var(--tone-cream)] md:text-4xl">You were disconnected</p>
            <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.86)]">
              Your match is still active. Rejoin to continue, or surrender to end the match.
            </p>
            {pendingSurrenderAfterReconnect && (
              <p className="mt-2 font-gabarito text-xs text-[rgba(244,240,230,0.76)]">
                Rejoining room to submit surrender...
              </p>
            )}
            {!canSurrenderByState && (
              <p className="mt-2 font-gabarito text-xs text-[rgba(244,240,230,0.76)]">
                Surrender is only available after the match is committed.
              </p>
            )}
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={onReconnect}
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
              >
                Rejoin Room
              </button>
              <button
                type="button"
                onClick={onConfirmSurrender}
                disabled={!canSurrenderByState || pendingSurrenderAfterReconnect}
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide disabled:opacity-50"
                style={{ border: "1px solid rgba(186,105,49,0.42)", color: "var(--tone-cream)", background: "rgba(77,42,24,0.92)" }}
              >
                Surrender
              </button>
            </div>
          </div>
        </div>
      )}

      {surrenderModalOpen && canSurrenderMatch && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[rgba(2,6,5,0.82)] p-4">
          <div
            className="frame-cut w-full max-w-lg p-5 md:p-6"
            style={{ border: "1px solid rgba(248,214,148,0.42)", background: "rgba(13,24,20,0.96)" }}
          >
            <p className="font-caprasimo text-3xl text-[var(--tone-cream)] md:text-4xl">Surrender match?</p>
            <p className="mt-2 font-gabarito text-sm text-[rgba(244,240,230,0.86)]">
              Surrendering means you forfeit this match. Your rival will receive the wager after settlement. You will
              return to lobby.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={onCloseSurrenderModal}
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(248,214,148,0.32)", color: "var(--tone-cream)", background: "rgba(19,32,26,0.9)" }}
              >
                Keep Playing
              </button>
              <button
                type="button"
                onClick={onConfirmSurrender}
                className="frame-cut frame-cut-sm px-4 py-2 font-gabarito text-xs font-extrabold uppercase tracking-wide"
                style={{ border: "1px solid rgba(186,105,49,0.42)", color: "var(--tone-cream)", background: "rgba(77,42,24,0.92)" }}
              >
                Surrender
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {isMatchComplete && (
          <motion.div
            key="match-result-backdrop"
            className="fixed inset-0 z-50 grid place-items-center bg-[rgba(2,6,5,0.82)] p-4 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              key="match-result-card"
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="frame-cut w-full max-w-2xl p-4 md:p-5"
              style={{
                border: "1px solid rgba(248,214,148,0.42)",
                background:
                  "radial-gradient(circle at top, rgba(255,243,215,0.9) 0%, rgba(247,227,190,0.9) 34%, rgba(239,213,170,0.95) 100%)",
                boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
              }}
            >
              <div className="text-center">
                <p
                  className="mx-auto max-w-[18ch] break-words font-caprasimo text-[clamp(2.2rem,6vw,4rem)] leading-[0.95] text-[#1f2b24]"
                  style={{ textWrap: "balance" }}
                >
                  {settlementText}
                </p>
                <p
                  className="mx-auto mt-2 max-w-xl font-gabarito text-sm text-[#4f6759]"
                  style={{ textWrap: "pretty" }}
                >
                  {settlementSubtitle}
                </p>
                <div className="mt-3 flex justify-center">
                  <span
                    className={`rounded-2xl px-4 py-2 text-center font-gabarito text-xs font-black uppercase tracking-[0.08em] md:text-sm ${
                      isWinPayoutHighlight ? "shadow-[0_10px_16px_rgba(39,65,55,0.2)]" : ""
                    }`}
                    style={
                      isWinPayoutHighlight
                        ? {
                            color: "#fff8e9",
                            border: "1px solid rgba(39,65,55,0.32)",
                            background: "linear-gradient(160deg, #274137 0%, #3b5d4f 100%)",
                          }
                        : {
                            color: "#486357",
                            border: "1px solid rgba(39,65,55,0.2)",
                            background: "rgba(255,248,236,0.9)",
                          }
                    }
                  >
                    {payoutHighlight}
                  </span>
                </div>
                {settlementEmojiMood && (
                  <div className="mt-4 flex w-full items-center justify-center gap-5 md:gap-10">
                    <div className="relative">
                      <div
                        className="relative rounded-[24px] border px-4 py-3"
                        style={{
                          borderColor: "rgba(39,65,55,0.22)",
                          background: "linear-gradient(150deg, rgba(255,251,244,0.98), rgba(244,229,200,0.98))",
                          boxShadow: "0 8px 14px rgba(33,67,53,0.14)",
                        }}
                      >
                        <div className="relative h-24 w-24 overflow-hidden rounded-[16px] border border-[rgba(39,65,55,0.2)] md:h-28 md:w-28">
                          {settlementExpressionSrc?.player && !failedExpressionSprites[settlementExpressionSrc.player] ? (
                            <Image
                              src={settlementExpressionSrc.player}
                              alt={`You ${settlementEmojiMood.player} expression`}
                              fill
                              sizes="(max-width: 768px) 96px, 112px"
                              className="object-cover object-center"
                              onError={() =>
                                setFailedExpressionSprites((prev) => ({
                                  ...prev,
                                  [settlementExpressionSrc.player!]: true,
                                }))
                              }
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center">
                              <span className="font-gabarito text-[10px] font-bold uppercase text-[#4f6759]">
                                {settlementEmojiMood.player}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="mt-2 font-gabarito text-[11px] font-black uppercase tracking-[0.12em] text-[#4f6759]">YOU</p>
                      </div>
                      <span
                        className="absolute -left-1 bottom-4 h-3.5 w-3.5 rotate-45 rounded-[2px] border-l border-b"
                        style={{
                          borderColor: "rgba(39,65,55,0.22)",
                          background: "rgba(246,232,206,0.98)",
                        }}
                      />
                    </div>
                    <div className="relative">
                      <div
                        className="relative rounded-[24px] border px-4 py-3"
                        style={{
                          borderColor: "rgba(111,58,40,0.22)",
                          background: "linear-gradient(150deg, rgba(255,251,244,0.98), rgba(244,229,200,0.98))",
                          boxShadow: "0 8px 14px rgba(111,58,40,0.14)",
                        }}
                      >
                        <div className="relative h-24 w-24 overflow-hidden rounded-[16px] border border-[rgba(111,58,40,0.2)] md:h-28 md:w-28">
                          {settlementExpressionSrc?.opponent && !failedExpressionSprites[settlementExpressionSrc.opponent] ? (
                            <Image
                              src={settlementExpressionSrc.opponent}
                              alt={`Your rival ${settlementEmojiMood.opponent} expression`}
                              fill
                              sizes="(max-width: 768px) 96px, 112px"
                              className="object-cover object-center"
                              onError={() =>
                                setFailedExpressionSprites((prev) => ({
                                  ...prev,
                                  [settlementExpressionSrc.opponent!]: true,
                                }))
                              }
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center">
                              <span className="font-gabarito text-[10px] font-bold uppercase text-[#6f3a28]">
                                {settlementEmojiMood.opponent}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="mt-2 font-gabarito text-[11px] font-black uppercase tracking-[0.12em] text-[#6f3a28]">
                          YOUR RIVAL
                        </p>
                      </div>
                      <span
                        className="absolute -right-1 bottom-4 h-3.5 w-3.5 rotate-45 rounded-[2px] border-r border-t"
                        style={{
                          borderColor: "rgba(111,58,40,0.22)",
                          background: "rgba(246,232,206,0.98)",
                        }}
                      />
                    </div>
                  </div>
                )}
                <div className="mt-3 flex justify-center">
                  <span
                    className="rounded-full px-3 py-1 font-gabarito text-[10px] font-extrabold uppercase tracking-[0.14em]"
                    style={settlementStatusStyle}
                  >
                    {settlementStatus}
                  </span>
                </div>
                {winnerLineText && (
                  <p className="mt-2 font-gabarito text-xs text-[#5e7768]">{winnerLineText}</p>
                )}
              </div>

              <div
                className="mt-4 frame-cut frame-cut-sm flex flex-wrap items-center justify-center gap-1.5 p-2"
                style={{ border: "1px solid rgba(39,65,55,0.16)", background: "rgba(255,248,236,0.92)" }}
              >
                <span
                  className="rounded-full px-2.5 py-1 font-gabarito text-[10px] font-black uppercase tracking-[0.1em] text-[#274137]"
                  style={{ background: "rgba(225,238,219,0.96)" }}
                >
                  Rounds {playerRoundsWon}-{opponentRoundsWon}
                </span>
                <span
                  className="rounded-full px-2.5 py-1 font-gabarito text-[10px] font-bold uppercase tracking-[0.1em] text-[#2a4a3c]"
                  style={{ background: "rgba(233,243,228,0.96)" }}
                >
                  Correct {correctCount}
                </span>
                <span
                  className="rounded-full px-2.5 py-1 font-gabarito text-[10px] font-bold uppercase tracking-[0.1em] text-[#6f3a28]"
                  style={{ background: "rgba(246,238,224,0.96)" }}
                >
                  Timeout {timeoutCount}
                </span>
                <span
                  className="rounded-full px-2.5 py-1 font-gabarito text-[10px] font-bold uppercase tracking-[0.1em] text-[#7c4a36]"
                  style={{ background: "rgba(245,234,228,0.96)" }}
                >
                  Wrong {wrongCount}
                </span>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={onToggleSettlementDetails}
                  className="font-gabarito text-xs font-bold uppercase tracking-[0.14em] text-[#4f6759] underline decoration-dotted underline-offset-2"
                >
                  {settlementDetailsOpen ? "Hide Settlement Details" : "Show Settlement Details"}
                </button>
              </div>

              {settlementDetailsOpen && (
                <div
                  className="mt-2 frame-cut frame-cut-sm space-y-1 p-3"
                  style={{ border: "1px solid rgba(39,65,55,0.16)", background: "rgba(255,248,236,0.95)" }}
                >
                  <p className="font-gabarito text-xs font-bold uppercase tracking-[0.1em] text-[#274137]">
                    Settlement Details
                  </p>
                  {settlementPayload ? (
                    <>
                      <p className="font-gabarito text-xs text-[#5e7768]">
                        Result signed by backend oracle and submitted by backend settlement flow.
                      </p>
                      <p className="break-all font-gabarito text-[11px] text-[#5e7768]">
                        Match ID: {settlementPayload.matchId}
                      </p>
                      <p className="break-all font-gabarito text-[11px] text-[#5e7768]">
                        Server Pubkey: {settlementPayload.serverPublicKey}
                      </p>
                      <p className="break-all font-gabarito text-[11px] text-[#5e7768]">
                        Settlement Signature: {settlementPayload.settlementSignature}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-gabarito text-xs text-[#5e7768]">
                        Waiting for server settlement payload...
                      </p>
                      <p className="break-all font-gabarito text-[11px] text-[#5e7768]">Match ID: unavailable</p>
                      <p className="break-all font-gabarito text-[11px] text-[#5e7768]">Server Pubkey: unavailable</p>
                      <p className="break-all font-gabarito text-[11px] text-[#5e7768]">
                        Settlement Signature: unavailable
                      </p>
                    </>
                  )}
                </div>
              )}

              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={onOpenShareModal}
                  className="frame-cut frame-cut-sm px-5 py-3 font-gabarito text-sm font-black uppercase tracking-[0.08em] transition hover:-translate-y-0.5"
                  style={{
                    border: "1px solid rgba(111,58,40,0.26)",
                    color: "#fff8e9",
                    background: "linear-gradient(160deg, #6f3a28 0%, #95512f 100%)",
                    boxShadow: "0 10px 14px rgba(64,29,20,0.24)",
                  }}
                >
                  Blink Share
                </button>
                <Link
                  href="/lobby"
                  onClick={onReturnToLobby}
                  className="frame-cut frame-cut-sm px-5 py-3 text-center font-gabarito text-sm font-black uppercase tracking-[0.08em] transition hover:-translate-y-0.5"
                  style={{
                    border: "1px solid rgba(39,65,55,0.22)",
                    color: "#274137",
                    background: "rgba(255,248,236,0.96)",
                    boxShadow: "0 10px 14px rgba(33,67,53,0.16)",
                  }}
                >
                  Back To Lobby
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {shareModalOpen && isMatchComplete && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-[rgba(7,12,10,0.72)] p-4">
          <div className="relative w-full max-w-3xl">
            <button
              type="button"
              onClick={onCloseShareModal}
              className="absolute right-1 top-1 z-10 frame-cut frame-cut-sm px-2 py-1 font-gabarito text-xs font-extrabold uppercase tracking-wide"
              style={{ border: "1px solid rgba(39,65,55,0.2)", color: "#274137", background: "rgba(255,248,236,0.95)" }}
            >
              Close
            </button>
            <ChallengeShareCard
              title="Challenge Me"
              challengerName="You"
              challengerAddress={address}
              arenaLabel={arenaLabel}
              token={arenaToken}
              wagerUsd={wagerUsd}
              challengeLink={challengeLink}
              description={challengeDescription}
              statusLabel={challengeStatusLabel}
              onCopy={onCopyChallengeLink}
              onSaveJpg={onSaveChallengeJpg}
              onShareX={onShareChallengeToX}
              notice={shareNotice}
            />
          </div>
        </div>
      )}
    </>
  );
}
