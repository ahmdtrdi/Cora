export const LOBBY_DRAFT_STORAGE_KEY = "cora:lobby-draft";
export const ACTIVE_ROOM_STORAGE_KEY = "cora:active-room";

const ACTIVE_DEPOSIT_INTENT_STORAGE_KEY = "cora:active-deposit-intent";

export type LobbyDraftSnapshot = {
  arenaId?: string | null;
  scientistId?: string | null;
};

export type ActiveMatchSession = {
  walletAddress?: string | null;
  address?: string | null;
  roomId: string;
  role?: "playerA" | "playerB" | null;
  arenaId?: string | null;
  scientistId?: string | null;
  status?: string | null;
  token?: string | null;
  arenaToken?: string | null;
  wagerUsd?: string | null;
  canSurrenderByState?: boolean;
};

type ActiveDepositIntent = {
  roomId: string;
  address: string;
  signature: string;
};

export function normalizeActiveMatchSession(value: unknown): ActiveMatchSession | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as Record<string, unknown>;
  const roomId = typeof snapshot.roomId === "string" ? snapshot.roomId : "";
  if (!roomId) return null;

  return {
    walletAddress:
      typeof snapshot.walletAddress === "string"
        ? snapshot.walletAddress
        : typeof snapshot.address === "string"
          ? snapshot.address
          : null,
    address:
      typeof snapshot.address === "string"
        ? snapshot.address
        : typeof snapshot.walletAddress === "string"
          ? snapshot.walletAddress
          : null,
    roomId,
    role: snapshot.role === "playerA" || snapshot.role === "playerB" ? snapshot.role : null,
    arenaId: typeof snapshot.arenaId === "string" ? snapshot.arenaId : null,
    scientistId: typeof snapshot.scientistId === "string" ? snapshot.scientistId : null,
    status: typeof snapshot.status === "string" ? snapshot.status : null,
    token:
      typeof snapshot.token === "string"
        ? snapshot.token
        : typeof snapshot.arenaToken === "string"
          ? snapshot.arenaToken
          : null,
    arenaToken:
      typeof snapshot.arenaToken === "string"
        ? snapshot.arenaToken
        : typeof snapshot.token === "string"
          ? snapshot.token
          : null,
    wagerUsd: typeof snapshot.wagerUsd === "string" ? snapshot.wagerUsd : null,
    canSurrenderByState: typeof snapshot.canSurrenderByState === "boolean" ? snapshot.canSurrenderByState : undefined,
  };
}

export function readActiveMatchSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_ROOM_STORAGE_KEY);
    if (!raw) return null;
    return normalizeActiveMatchSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeActiveMatchSession(snapshot: ActiveMatchSession | null) {
  if (typeof window === "undefined") return;
  if (!snapshot) {
    window.localStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
    clearActiveDepositIntent();
    return;
  }
  window.localStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, JSON.stringify(snapshot));
}

export function getMatchSessionAddress(snapshot: ActiveMatchSession | null) {
  if (!snapshot) return "";
  return snapshot.walletAddress?.trim() || snapshot.address?.trim() || "";
}

export function getMatchSessionToken(snapshot: ActiveMatchSession | null) {
  if (!snapshot) return null;
  return snapshot.token?.trim() || snapshot.arenaToken?.trim() || null;
}

export function isLiveMatchSession(snapshot: ActiveMatchSession | null) {
  if (!snapshot?.roomId) return false;
  return snapshot.status === "playing" || typeof snapshot.canSurrenderByState === "boolean";
}

export function readLobbyDraftSnapshot(): LobbyDraftSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LOBBY_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as LobbyDraftSnapshot;
    return snapshot && typeof snapshot === "object" ? snapshot : null;
  } catch {
    return null;
  }
}

export function writeLobbyDraftSnapshot(snapshot: LobbyDraftSnapshot) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(LOBBY_DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearMatchSessionState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
  window.sessionStorage.removeItem(LOBBY_DRAFT_STORAGE_KEY);
  clearActiveDepositIntent();
}

export function writeActiveDepositIntent(intent: ActiveDepositIntent) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ACTIVE_DEPOSIT_INTENT_STORAGE_KEY, JSON.stringify(intent));
}

export function readActiveDepositIntent(roomId: string, address: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_DEPOSIT_INTENT_STORAGE_KEY);
    if (!raw) return null;
    const intent = JSON.parse(raw) as Partial<ActiveDepositIntent>;
    if (intent.roomId !== roomId || intent.address !== address) return null;
    return typeof intent.signature === "string" && intent.signature ? intent.signature : null;
  } catch {
    return null;
  }
}

export function clearActiveDepositIntent() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(ACTIVE_DEPOSIT_INTENT_STORAGE_KEY);
}
