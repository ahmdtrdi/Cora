// @ts-nocheck
import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";

import {
  activateSession,
  authority,
  createSession,
  fetchSession,
  registerEffectCard,
  TEST_CONSTANTS,
} from "./helpers/battleTestUtils";
import {
  assertMagicBlockLocalStackEnv,
  baseProgram,
  confirmEphemeralAccountVisible,
  describeMagicBlockLocalStack,
  ephemeralProgram,
  fetchOwner,
  localValidatorIdentity,
  sendMagicRouterTransaction,
  waitForMagicBlockRpcReady,
  waitForCondition,
} from "./helpers/magicblockLocalStackUtils";

describeMagicBlockLocalStack("magicblock local stack", function () {
  this.timeout(180_000);

  before(async () => {
    assertMagicBlockLocalStackEnv();
    await waitForMagicBlockRpcReady();
  });

  it("delegates, executes on ER, commits, and undelegates session + registered card", async () => {
    console.log("[magicblock-test] create session");
    const { sessionPda, playerA } = await createSession();
    console.log("[magicblock-test] register effect card");
    const { cardId, cardPda } = await registerEffectCard({
      sessionPda,
      cardIndex: 0,
      owner: playerA.publicKey,
      effectType: TEST_CONSTANTS.effectAttack,
      maxValue: 35,
    });
    console.log("[magicblock-test] activate session");
    await activateSession(sessionPda);

    const originalSessionOwner = await fetchOwner(baseProgram, sessionPda);
    const originalCardOwner = await fetchOwner(baseProgram, cardPda);

    expect(originalSessionOwner?.toBase58()).to.equal(
      baseProgram.programId.toBase58()
    );
    expect(originalCardOwner?.toBase58()).to.equal(
      baseProgram.programId.toBase58()
    );

    console.log("[magicblock-test] delegate battle session + registered card");
    const delegateSessionIx = await baseProgram.methods
      .delegateBattleSession()
      .accounts({
        payer: authority.publicKey,
        battleSession: sessionPda,
      })
      .remainingAccounts([
        {
          pubkey: localValidatorIdentity,
          isSigner: false,
          isWritable: false,
        },
      ])
      .instruction();

    const delegateCardIx = await baseProgram.methods
      .delegateRegisteredCard(cardId)
      .accounts({
        payer: authority.publicKey,
        battleSession: sessionPda,
        registeredCard: cardPda,
      })
      .remainingAccounts([
        {
          pubkey: localValidatorIdentity,
          isSigner: false,
          isWritable: false,
        },
      ])
      .instruction();

    const delegateTx = new anchor.web3.Transaction().add(
      delegateSessionIx,
      delegateCardIx
    );
    await baseProgram.provider.sendAndConfirm(delegateTx, []);

    console.log("[magicblock-test] wait ephemeral visibility");
    await confirmEphemeralAccountVisible(sessionPda, "battleSession");
    await confirmEphemeralAccountVisible(cardPda, "registeredCard");
    await waitForCondition("ephemeral ownership sync", async () => {
      const sessionOwner = await fetchOwner(ephemeralProgram, sessionPda);
      const cardOwner = await fetchOwner(ephemeralProgram, cardPda);
      return (
        sessionOwner?.equals(ephemeralProgram.programId) &&
        cardOwner?.equals(ephemeralProgram.programId)
      );
    });

    console.log("[magicblock-test] apply effect on ER");
    const applyEffectBuilder = ephemeralProgram.methods
      .applyCardEffect(30, 120)
      .accounts({
        authority: authority.publicKey,
        battleSession: sessionPda,
        registeredCard: cardPda,
      });

    // Warm the local ER route once before the first writable mutation.
    try {
      await applyEffectBuilder.simulate();
    } catch {
      // The local MagicBlock stack may reject or no-op this warm-up call.
    }

    await waitForCondition(
      "first ER writable apply_card_effect transaction",
      async () => {
        const applyEffectTx = await applyEffectBuilder.transaction();

        try {
          await sendMagicRouterTransaction(applyEffectTx);
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (
            message.includes("cannot be written") ||
            message.includes("InvalidWritableAccount")
          ) {
            return false;
          }
          throw error;
        }
      },
      15_000,
      500
    );

    const ephemeralSession =
      await ephemeralProgram.account.battleSession.fetch(sessionPda);
    expect(ephemeralSession.healthB).to.equal(TEST_CONSTANTS.initialHealth - 30);
    expect(ephemeralSession.gameScoreA).to.equal(120);
    expect(ephemeralSession.totalPlays).to.equal(1);

    console.log("[magicblock-test] commit card");
    const commitCardTx = await ephemeralProgram.methods
      .commitRegisteredCard()
      .accounts({
        payer: authority.publicKey,
        battleSession: sessionPda,
        registeredCard: cardPda,
      })
      .transaction();
    await sendMagicRouterTransaction(commitCardTx);

    console.log("[magicblock-test] commit session");
    const commitSessionTx = await ephemeralProgram.methods
      .commitBattleSession()
      .accounts({
        payer: authority.publicKey,
        battleSession: sessionPda,
      })
      .transaction();
    await sendMagicRouterTransaction(commitSessionTx);

    await waitForCondition("committed battle session on base layer", async () => {
      const baseSession = await fetchSession(sessionPda);
      return (
        baseSession.healthB === TEST_CONSTANTS.initialHealth - 30 &&
        baseSession.gameScoreA === 120 &&
        baseSession.totalPlays === 1
      );
    });

    console.log("[magicblock-test] undelegate card");
    const undelegateCardTx = await ephemeralProgram.methods
      .undelegateRegisteredCard()
      .accounts({
        payer: authority.publicKey,
        battleSession: sessionPda,
        registeredCard: cardPda,
      })
      .transaction();
    await sendMagicRouterTransaction(undelegateCardTx);

    console.log("[magicblock-test] undelegate session");
    const undelegateSessionTx = await ephemeralProgram.methods
      .undelegateBattleSession()
      .accounts({
        payer: authority.publicKey,
        battleSession: sessionPda,
      })
      .transaction();
    await sendMagicRouterTransaction(undelegateSessionTx);

    await waitForCondition("battle session owner restored on base layer", async () => {
      const owner = await fetchOwner(baseProgram, sessionPda);
      return owner?.equals(baseProgram.programId) ?? false;
    });

    await waitForCondition("registered card owner restored on base layer", async () => {
      const owner = await fetchOwner(baseProgram, cardPda);
      return owner?.equals(baseProgram.programId) ?? false;
    });
  });
});
