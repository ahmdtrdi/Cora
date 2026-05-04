export type RuntimeMode = "mock" | "phantom";

type RuntimeConfig = {
  depositMode: RuntimeMode;
  settlementMode: RuntimeMode;
  allowDevAddressFallback: boolean;
  allowDevCharacterFallback: boolean;
  allowDevRoomPreview: boolean;
};

function readMode(value: string | undefined, fallback: RuntimeMode): RuntimeMode {
  if (value === "mock" || value === "phantom") {
    return value;
  }
  if (process.env.NODE_ENV !== "production" && value) {
    console.warn(
      `[runtimeModes] Invalid mode "${value}" detected. Falling back to "${fallback}".`,
    );
  }
  return fallback;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  if (process.env.NODE_ENV !== "production" && value) {
    console.warn(
      `[runtimeModes] Invalid boolean "${value}" detected. Falling back to "${String(fallback)}".`,
    );
  }
  return fallback;
}

export function getRuntimeConfig(): RuntimeConfig {
  return {
    depositMode: readMode(process.env.NEXT_PUBLIC_DEPOSIT_MODE, "phantom"),
    settlementMode: readMode(process.env.NEXT_PUBLIC_SETTLEMENT_MODE, "mock"),
    allowDevAddressFallback: readBoolean(
      process.env.NEXT_PUBLIC_ALLOW_DEV_ADDRESS_FALLBACK,
      false,
    ),
    allowDevCharacterFallback: readBoolean(
      process.env.NEXT_PUBLIC_ALLOW_DEV_CHARACTER_FALLBACK,
      false,
    ),
    allowDevRoomPreview: readBoolean(
      process.env.NEXT_PUBLIC_ALLOW_DEV_ROOM_PREVIEW,
      false,
    ),
  };
}

export function isIntegrationMode(config: RuntimeConfig): boolean {
  return config.depositMode !== "phantom" || config.settlementMode !== "phantom";
}
