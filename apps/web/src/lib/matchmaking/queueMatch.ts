type QueueMatchParams = {
  address: string;
  tokenMint?: string;
  wagerAmount?: number;
  signal?: AbortSignal;
};

type QueueMatchResponse = {
  roomId: string;
  tokenMint?: string;
  wagerAmount?: string;
  roomType?: "public" | "private";
};

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

export async function queueMatch({ address, tokenMint, wagerAmount, signal }: QueueMatchParams): Promise<QueueMatchResponse> {
  const apiBaseUrl = resolveApiBaseUrl();
  const body: {
    address: string;
    tokenMint?: string;
    wagerAmount?: number;
  } = { address };
  if (tokenMint) body.tokenMint = tokenMint;
  if (wagerAmount !== undefined) body.wagerAmount = wagerAmount;

  const response = await fetch(`${apiBaseUrl}/match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  const payload = (await response.json().catch(() => null)) as {
    roomId?: string;
    tokenMint?: string;
    wagerAmount?: string;
    roomType?: "public" | "private";
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Matchmaking failed (${response.status}).`);
  }

  const roomId = payload?.roomId;
  if (!roomId) {
    throw new Error("Matchmaking response missing roomId.");
  }

  return {
    roomId,
    tokenMint: payload?.tokenMint,
    wagerAmount: payload?.wagerAmount,
    roomType: payload?.roomType,
  };
}
