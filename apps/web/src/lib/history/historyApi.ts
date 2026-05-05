import type { MatchHistoryItem, WalletPlayability } from "./historyTypes";

type WalletPlayabilityParams = {
  address: string;
  arenaId: string;
  token: string;
};

type HistoryEndpointPayload = {
  items?: unknown[];
  history?: unknown[];
};

const HISTORY_FALLBACK_MODE = (process.env.NEXT_PUBLIC_HISTORY_FALLBACK_MODE ?? "mock").trim().toLowerCase();

function trimTrailingSlash(input: string) {
  return input.replace(/\/+$/, "");
}

function resolveApiBaseUrl() {
  const explicit = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();
  if (explicit) {
    return trimTrailingSlash(explicit);
  }

  const wsUrl = (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080").trim();
  if (wsUrl.startsWith("wss://")) {
    return trimTrailingSlash(`https://${wsUrl.slice("wss://".length)}`);
  }
  if (wsUrl.startsWith("ws://")) {
    return trimTrailingSlash(`http://${wsUrl.slice("ws://".length)}`);
  }
  return trimTrailingSlash(wsUrl);
}

function toSafeString(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return fallback;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeHistoryItem(raw: unknown, fallback: { arenaId: string; token: string; index: number }): MatchHistoryItem {
  const record = isObjectRecord(raw) ? raw : {};
  const id =
    toSafeString(record.id) ||
    toSafeString(record.matchId) ||
    toSafeString(record.signature) ||
    `${fallback.arenaId}-${fallback.index}`;
  const signature = toSafeString(record.signature, "unknown");
  const timestamp = toSafeString(record.timestamp) || new Date().toISOString();
  const arenaId = toSafeString(record.arenaId) || fallback.arenaId;
  const token = toSafeString(record.token) || fallback.token;
  const wagerUsd = toSafeString(record.wagerUsd) || toSafeString(record.wager);
  const opponent = toSafeString(record.opponent);
  const explorerUrl = toSafeString(record.explorerUrl);

  const resultRaw = toSafeString(record.result, "unknown").toLowerCase();
  const result: MatchHistoryItem["result"] =
    resultRaw === "win" || resultRaw === "loss" || resultRaw === "draw" ? resultRaw : "unknown";

  const settlementRaw = toSafeString(record.settlementStatus, "unknown").toLowerCase();
  const settlementStatus: MatchHistoryItem["settlementStatus"] =
    settlementRaw === "settled" || settlementRaw === "pending" || settlementRaw === "failed"
      ? settlementRaw
      : "unknown";

  return {
    id,
    signature,
    timestamp,
    arenaId,
    token,
    wagerUsd: wagerUsd || undefined,
    result,
    opponent: opponent || undefined,
    settlementStatus,
    explorerUrl: explorerUrl || undefined,
  };
}

function normalizeHistoryPayload(
  payload: unknown,
  fallback: { arenaId: string; token: string },
): MatchHistoryItem[] {
  if (Array.isArray(payload)) {
    return payload.map((item, index) => normalizeHistoryItem(item, { ...fallback, index }));
  }

  if (!isObjectRecord(payload)) {
    return [];
  }

  const data = payload as HistoryEndpointPayload;
  const rawItems = Array.isArray(data.items) ? data.items : Array.isArray(data.history) ? data.history : [];
  return rawItems.map((item, index) => normalizeHistoryItem(item, { ...fallback, index }));
}

function normalizePlayability(payload: unknown): WalletPlayability {
  if (!isObjectRecord(payload)) {
    return {
      playable: true,
      reason: "Unable to inspect wallet right now.",
      reliable: false,
      lastCheckedAt: new Date().toISOString(),
    };
  }

  const playable = typeof payload.playable === "boolean" ? payload.playable : true;
  const reliable = payload.reliable === true;
  return {
    playable,
    reason: toSafeString(payload.reason) || undefined,
    tokenBalance: toSafeString(payload.tokenBalance) || undefined,
    requiredBalance: toSafeString(payload.requiredBalance) || undefined,
    lastCheckedAt: toSafeString(payload.lastCheckedAt) || new Date().toISOString(),
    reliable,
  };
}

function shouldUseMockFallback() {
  return HISTORY_FALLBACK_MODE === "mock";
}

function shouldUseEmptyFallback() {
  return HISTORY_FALLBACK_MODE === "empty";
}

function createMockHistory(override: { arenaId: string; token: string }): MatchHistoryItem[] {
  const now = Date.now();
  return [
    {
      id: `${override.arenaId}-recent-1`,
      signature: "5R6q...J8k2",
      timestamp: new Date(now - 1000 * 60 * 38).toISOString(),
      arenaId: override.arenaId,
      token: override.token,
      wagerUsd: "1.00",
      result: "win",
      opponent: "3xj2...eT9k",
      settlementStatus: "settled",
    },
    {
      id: `${override.arenaId}-recent-2`,
      signature: "7Nzf...Q2br",
      timestamp: new Date(now - 1000 * 60 * 95).toISOString(),
      arenaId: override.arenaId,
      token: override.token,
      wagerUsd: "1.00",
      result: "loss",
      opponent: "5Vh1...gPw8",
      settlementStatus: "settled",
    },
    {
      id: `${override.arenaId}-recent-3`,
      signature: "4ddP...rK61",
      timestamp: new Date(now - 1000 * 60 * 180).toISOString(),
      arenaId: override.arenaId,
      token: override.token,
      wagerUsd: "1.00",
      result: "unknown",
      opponent: "9cwY...7hAs",
      settlementStatus: "pending",
    },
  ];
}

async function readJson(path: string): Promise<unknown> {
  const apiBaseUrl = resolveApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      isObjectRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

export async function getArenaHistory(arenaId: string): Promise<MatchHistoryItem[]> {
  const safeArenaId = arenaId || "unknown";
  const fallback = { arenaId: safeArenaId, token: safeArenaId.toUpperCase() };

  try {
    const payload = await readJson(`/api/history/arena/${encodeURIComponent(safeArenaId)}`);
    return normalizeHistoryPayload(payload, fallback);
  } catch (error) {
    if (shouldUseEmptyFallback()) {
      return [];
    }
    if (shouldUseMockFallback()) {
      return createMockHistory(fallback);
    }
    throw new Error(error instanceof Error ? error.message : "History unavailable. Try again later.");
  }
}

export async function getWalletHistory(address: string): Promise<MatchHistoryItem[]> {
  const safeAddress = address.trim();
  const fallback = { arenaId: "unknown", token: "SOL" };

  if (!safeAddress) {
    return [];
  }

  try {
    const payload = await readJson(`/api/history/wallet/${encodeURIComponent(safeAddress)}`);
    return normalizeHistoryPayload(payload, fallback);
  } catch (error) {
    if (shouldUseEmptyFallback()) {
      return [];
    }
    if (shouldUseMockFallback()) {
      return createMockHistory(fallback);
    }
    throw new Error(error instanceof Error ? error.message : "History unavailable. Try again later.");
  }
}

export async function getWalletArenaPlayability(params: WalletPlayabilityParams): Promise<WalletPlayability> {
  const safeAddress = params.address.trim();
  if (!safeAddress) {
    return {
      playable: true,
      reason: "Connect wallet to inspect arena readiness.",
      reliable: false,
      lastCheckedAt: new Date().toISOString(),
    };
  }

  try {
    const query = new URLSearchParams({
      arena: params.arenaId,
      token: params.token,
    });
    const payload = await readJson(
      `/api/history/wallet/${encodeURIComponent(safeAddress)}/playability?${query.toString()}`,
    );
    return normalizePlayability(payload);
  } catch (error) {
    if (!shouldUseMockFallback() && !shouldUseEmptyFallback()) {
      throw new Error(error instanceof Error ? error.message : "Unable to inspect wallet right now.");
    }
    return {
      playable: true,
      reason: `Unable to inspect ${params.token} balance right now.`,
      tokenBalance: undefined,
      requiredBalance: undefined,
      reliable: false,
      lastCheckedAt: new Date().toISOString(),
    };
  }
}
