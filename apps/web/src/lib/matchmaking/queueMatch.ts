type QueueMatchParams = {
  address: string;
  signal?: AbortSignal;
};

type QueueMatchResponse = {
  roomId: string;
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

export async function queueMatch({ address, signal }: QueueMatchParams): Promise<QueueMatchResponse> {
  const apiBaseUrl = resolveApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ address }),
    signal,
  });

  const payload = (await response.json().catch(() => null)) as { roomId?: string; error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Matchmaking failed (${response.status}).`);
  }

  const roomId = payload?.roomId;
  if (!roomId) {
    throw new Error("Matchmaking response missing roomId.");
  }

  return { roomId };
}
