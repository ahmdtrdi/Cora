import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  type Connection,
} from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

type SignDepositIntentParams = {
  connection: Connection;
  wallet: WalletContextState;
  roomId: string;
  token: string;
  wagerUsd: string;
};

type SignSettlementReleaseIntentParams = {
  connection: Connection;
  wallet: WalletContextState;
  matchId: string;
  winner: string;
};

export class DepositIntentError extends Error {
  code:
    | "wallet_not_connected"
    | "wallet_signing_not_supported"
    | "wallet_declined"
    | "insufficient_balance"
    | "rpc_error"
    | "unknown";

  constructor(
    code:
      | "wallet_not_connected"
      | "wallet_signing_not_supported"
      | "wallet_declined"
      | "insufficient_balance"
      | "rpc_error"
      | "unknown",
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

function mapWalletError(error: unknown): DepositIntentError {
  const message = error instanceof Error ? error.message : "Unknown wallet error";
  const lowered = message.toLowerCase();

  if (lowered.includes("rejected") || lowered.includes("denied") || lowered.includes("cancel")) {
    return new DepositIntentError("wallet_declined", "Wallet request was declined.");
  }

  if (lowered.includes("insufficient")) {
    return new DepositIntentError(
      "insufficient_balance",
      "Insufficient balance for transaction fees.",
    );
  }

  if (
    lowered.includes("blockhash") ||
    lowered.includes("rpc")
  ) {
    return new DepositIntentError("rpc_error", "Transaction failed to confirm on Solana.");
  }

  if (lowered.includes("failed on-chain")) {
    return new DepositIntentError("unknown", message);
  }

  return new DepositIntentError("unknown", message);
}

async function signMemoIntent({
  connection,
  wallet,
  memoMessage,
}: {
  connection: Connection;
  wallet: WalletContextState;
  memoMessage: string;
}): Promise<string> {
  if (!wallet.publicKey) {
    throw new DepositIntentError("wallet_not_connected", "Connect wallet before signing.");
  }

  if (!wallet.sendTransaction) {
    throw new DepositIntentError(
      "wallet_signing_not_supported",
      "Connected wallet does not support transaction signing.",
    );
  }

  const instruction = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: new TextEncoder().encode(memoMessage),
  });

  const transaction = new Transaction().add(instruction);

  try {
    const latest = await connection.getLatestBlockhash("confirmed");
    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = latest.blockhash;

    const signature = await wallet.sendTransaction(transaction, connection, {
      preflightCommitment: "confirmed",
      maxRetries: 2,
    });

    await connection.confirmTransaction(
      {
        signature,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      "confirmed",
    );

    return signature;
  } catch (error) {
    throw mapWalletError(error);
  }
}

export async function signDepositIntent({
  connection,
  wallet,
  roomId,
  token,
  wagerUsd,
}: SignDepositIntentParams): Promise<string> {
  if (!wallet.publicKey) {
    throw new DepositIntentError("wallet_not_connected", "Connect wallet before signing.");
  }
  if (!wallet.sendTransaction) {
    throw new DepositIntentError(
      "wallet_signing_not_supported",
      "Connected wallet does not support transaction signing.",
    );
  }

  try {
    const apiBase = resolveApiBaseUrl();
    const res = await fetch(`${apiBase}/api/actions/challenge?roomId=${roomId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        account: wallet.publicKey.toBase58(),
        tokenMint: token,
        wagerAmount: Math.floor(parseFloat(wagerUsd) * 1_000_000) 
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || "Failed to fetch deposit transaction");
    }

    const { transaction: base64Tx } = await res.json();
    const txBuffer = Buffer.from(base64Tx, "base64");
    const transaction = Transaction.from(txBuffer);

    // Latest blockhash should have been attached by the server, but let's be safe
    const latest = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = latest.blockhash;
    transaction.feePayer = wallet.publicKey;

    const signature = await wallet.sendTransaction(transaction, connection, {
      preflightCommitment: "confirmed",
      maxRetries: 2,
      skipPreflight: true,
    });

    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      "confirmed",
    );

    if (confirmation.value.err) {
      throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
    }

    return signature;
  } catch (error) {
    throw mapWalletError(error);
  }
}

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

export async function signSettlementReleaseIntent({
  connection,
  wallet,
  matchId,
  winner,
}: SignSettlementReleaseIntentParams): Promise<string> {
  const memoMessage = `CORA_SETTLEMENT_RELEASE:${matchId}:${winner}:${wallet.publicKey?.toBase58() ?? "unknown"}`;
  return signMemoIntent({
    connection,
    wallet,
    memoMessage,
  });
}
