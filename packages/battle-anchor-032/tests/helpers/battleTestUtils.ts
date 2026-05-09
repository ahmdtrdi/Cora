// @ts-nocheck
import * as anchor from "@coral-xyz/anchor";
import { Program, IdlAccounts } from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { expect } from "chai";

import idl from "../../target/idl/cora_battle.json";
import { CoraBattle } from "../../target/types/cora_battle";

export const DECLARED_BATTLE_PROGRAM_ID =
  "3eMDYJTc5uxA5CueLoRvdCiCvhUnjSZS7gVwX6jREQR8";

const correctedIdl = {
  ...idl,
  address: DECLARED_BATTLE_PROGRAM_ID,
};

export const TEST_CONSTANTS = {
  initialHealth: 100,
  maxRounds: 3,
  roundsToWin: 2,
  roundDurationSeconds: 180,
  minDamage: 1,
  maxDamage: 100,
  maxEffectValue: 100,
  maxScoreDelta: 10_000,
  sessionTimeout: 900,
  effectAttack: 1,
  effectHeal: 2,
  effectNone: 3,
  endReasonNone: 0,
  endReasonNormalWin: 1,
  endReasonSinglePlayerTimeout: 2,
  endReasonBothPlayersTimeout: 3,
  endReasonServerCancelled: 4,
  endReasonCheaterFlagged: 5,
  endReasonForceEnded: 6,
  endReasonDrawNoContest: 7,
} as const;

export type BattleSessionAccount = IdlAccounts<CoraBattle>["battleSession"];
export type RegisteredCardAccount = IdlAccounts<CoraBattle>["registeredCard"];

export const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

export const program = new anchor.Program<CoraBattle>(
  correctedIdl as CoraBattle,
  provider
);
export const authority = provider.wallet as anchor.Wallet;

export function makeMatchId(): number[] {
  return Array.from(Keypair.generate().publicKey.toBytes());
}

export function makeQuestionHash(fill = 7): number[] {
  return Array(32).fill(fill);
}

export function makeCardId(index: number): number[] {
  const cardId = Array(16).fill(0);
  cardId[0] = index;
  return cardId;
}

export function findBattlePda(matchId: number[]): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("battle"), Buffer.from(matchId)],
    program.programId
  );
}

export function findCardPda(
  sessionPda: PublicKey,
  cardId: number[]
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("card"), sessionPda.toBuffer(), Buffer.from(cardId)],
    program.programId
  );
}

export function battleStatusName(status: BattleSessionAccount["status"]): string {
  return Object.keys(status)[0] ?? "";
}

export async function expectAnchorError(
  promise: Promise<unknown>,
  expectedText: string
): Promise<void> {
  try {
    await promise;
    expect.fail(`Expected error including "${expectedText}"`);
  } catch (error: any) {
    const errorText = [
      error?.error?.errorCode?.code,
      error?.error?.errorMessage,
      error?.logs?.join("\n"),
      error?.toString?.(),
    ]
      .filter(Boolean)
      .join("\n");

    expect(errorText).to.include(expectedText);
  }
}

export async function airdropSol(
  publicKey: PublicKey,
  lamports = LAMPORTS_PER_SOL
): Promise<void> {
  const signature = await provider.connection.requestAirdrop(publicKey, lamports);
  await provider.connection.confirmTransaction(signature, "confirmed");
}

export async function createSession(params?: {
  matchId?: number[];
  questionHash?: number[];
  playerA?: Keypair;
  playerB?: Keypair;
}) {
  const matchId = params?.matchId ?? makeMatchId();
  const questionHash = params?.questionHash ?? makeQuestionHash();
  const playerA = params?.playerA ?? Keypair.generate();
  const playerB = params?.playerB ?? Keypair.generate();
  const [sessionPda] = findBattlePda(matchId);

  await program.methods
    .createSession(matchId, questionHash)
    .accounts({
      authority: authority.publicKey,
      playerA: playerA.publicKey,
      playerB: playerB.publicKey,
      battleSession: sessionPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { matchId, questionHash, playerA, playerB, sessionPda };
}

export async function activateSession(sessionPda: PublicKey): Promise<void> {
  await program.methods
    .activateSession()
    .accounts({
      authority: authority.publicKey,
      battleSession: sessionPda,
    })
    .rpc();
}

export async function registerLegacyCard(params: {
  sessionPda: PublicKey;
  cardIndex: number;
  damage: number;
}) {
  const cardId = makeCardId(params.cardIndex);
  const [cardPda] = findCardPda(params.sessionPda, cardId);

  await program.methods
    .registerCard(cardId, params.damage)
    .accounts({
      authority: authority.publicKey,
      battleSession: params.sessionPda,
      registeredCard: cardPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { cardId, cardPda };
}

export async function registerEffectCard(params: {
  sessionPda: PublicKey;
  cardIndex: number;
  owner: PublicKey;
  effectType: number;
  maxValue: number;
}) {
  const cardId = makeCardId(params.cardIndex);
  const [cardPda] = findCardPda(params.sessionPda, cardId);

  await program.methods
    .registerCardV2(
      cardId,
      params.owner,
      params.effectType,
      params.maxValue
    )
    .accounts({
      authority: authority.publicKey,
      battleSession: params.sessionPda,
      registeredCard: cardPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { cardId, cardPda };
}

export async function fetchSession(
  sessionPda: PublicKey
): Promise<BattleSessionAccount> {
  return program.account.battleSession.fetch(sessionPda);
}

export async function fetchCard(
  cardPda: PublicKey
): Promise<RegisteredCardAccount> {
  return program.account.registeredCard.fetch(cardPda);
}

export async function createActivatedLegacyBattle(params?: {
  playerA?: Keypair;
  playerB?: Keypair;
  cardDamages?: number[];
}) {
  const session = await createSession({
    playerA: params?.playerA,
    playerB: params?.playerB,
  });
  const cardDamages = params?.cardDamages ?? [25, 25, 25, 25];
  const cardPdas: PublicKey[] = [];

  for (const [index, damage] of cardDamages.entries()) {
    const { cardPda } = await registerLegacyCard({
      sessionPda: session.sessionPda,
      cardIndex: index,
      damage,
    });
    cardPdas.push(cardPda);
  }

  await activateSession(session.sessionPda);

  return {
    ...session,
    cardPdas,
  };
}

export async function createFinishedKoBattle() {
  const playerA = Keypair.generate();
  const playerB = Keypair.generate();
  const session = await createActivatedLegacyBattle({
    playerA,
    playerB,
    cardDamages: [100, 100],
  });

  await program.methods
    .applyDamage(playerA.publicKey)
    .accounts({
      authority: authority.publicKey,
      battleSession: session.sessionPda,
      registeredCard: session.cardPdas[0],
    })
    .rpc();

  await program.methods
    .applyDamage(playerA.publicKey)
    .accounts({
      authority: authority.publicKey,
      battleSession: session.sessionPda,
      registeredCard: session.cardPdas[1],
    })
    .rpc();

  return {
    ...session,
    playerA,
    playerB,
  };
}
