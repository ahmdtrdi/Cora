import type { CSSProperties } from "react";
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
              className="frame-cut w-full max-w-xl p-5 md:p-6"
              style={{
                border: "1px solid rgba(248,214,148,0.42)",
                background:
                  "radial-gradient(circle at top, rgba(255,243,215,0.9) 0%, rgba(247,227,190,0.9) 34%, rgba(239,213,170,0.95) 100%)",
                boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
              }}
            >
              <div className="text-center">
                <p className="font-caprasimo text-5xl leading-none text-[#1f2b24] md:text-6xl">{settlementText}</p>
                <p className="mt-2 font-gabarito text-sm text-[#4f6759]">{settlementSubtitle}</p>
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

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div
                  className="frame-cut frame-cut-sm p-3 text-center"
                  style={{ border: "1px solid rgba(39,65,55,0.2)", background: "rgba(255,248,236,0.92)" }}
                >
                  <p className="font-gabarito text-[10px] uppercase tracking-[0.12em] text-[#6d8373]">Your Rounds</p>
                  <p className="font-caprasimo text-3xl text-[#274137]">{playerRoundsWon}</p>
                </div>
                <div
                  className="frame-cut frame-cut-sm p-3 text-center"
                  style={{ border: "1px solid rgba(111,58,40,0.2)", background: "rgba(255,248,236,0.92)" }}
                >
                  <p className="font-gabarito text-[10px] uppercase tracking-[0.12em] text-[#6d8373]">Opponent Rounds</p>
                  <p className="font-caprasimo text-3xl text-[#6f3a28]">{opponentRoundsWon}</p>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2">
                <div
                  className="frame-cut frame-cut-sm p-2 text-center"
                  style={{ border: "1px solid rgba(39,65,55,0.18)", background: "#edf4eb" }}
                >
                  <p className="font-gabarito text-[10px] uppercase tracking-[0.12em] text-[#6d8373]">Correct</p>
                  <p className="font-caprasimo text-2xl text-[#274137]">{correctCount}</p>
                </div>
                <div
                  className="frame-cut frame-cut-sm p-2 text-center"
                  style={{ border: "1px solid rgba(39,65,55,0.18)", background: "#f6eee0" }}
                >
                  <p className="font-gabarito text-[10px] uppercase tracking-[0.12em] text-[#6d8373]">Timeout</p>
                  <p className="font-caprasimo text-2xl text-[#6f3a28]">{timeoutCount}</p>
                </div>
                <div
                  className="frame-cut frame-cut-sm p-2 text-center"
                  style={{ border: "1px solid rgba(39,65,55,0.18)", background: "#f4e8e2" }}
                >
                  <p className="font-gabarito text-[10px] uppercase tracking-[0.12em] text-[#6d8373]">Wrong</p>
                  <p className="font-caprasimo text-2xl text-[#7c4a36]">{wrongCount}</p>
                </div>
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
