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

export class DepositIntentError extends Error {
  code:
    | "wallet_not_connected"
    | "wallet_signing_not_supported"
    | "wallet_declined"
    | "rpc_error"
    | "unknown";

  constructor(
    code:
      | "wallet_not_connected"
      | "wallet_signing_not_supported"
      | "wallet_declined"
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

  if (
    lowered.includes("insufficient") ||
    lowered.includes("blockhash") ||
    lowered.includes("rpc")
  ) {
    return new DepositIntentError("rpc_error", "Transaction failed to confirm on Solana.");
  }

  return new DepositIntentError("unknown", message);
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

  const memoMessage = `CORA_DEPOSIT_INTENT:${roomId}:${token}:${wagerUsd}:${wallet.publicKey.toBase58()}`;
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
