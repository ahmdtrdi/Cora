// @ts-nocheck
import { expect } from "chai";

import {
  TEST_CONSTANTS,
  activateSession,
  authority,
  createSession,
  expectAnchorError,
  fetchSession,
  program,
  registerEffectCard,
} from "./helpers/battleTestUtils";

describe("apply_card_effect", () => {
  it("applies an attack effect and updates gameplay state", async () => {
    const { sessionPda, playerA } = await createSession();
    const { cardPda } = await registerEffectCard({
      sessionPda,
      cardIndex: 0,
      owner: playerA.publicKey,
      effectType: TEST_CONSTANTS.effectAttack,
      maxValue: 50,
    });
    await activateSession(sessionPda);

    await program.methods
      .applyCardEffect(30, 100)
      .accounts({
        authority: authority.publicKey,
        battleSession: sessionPda,
        registeredCard: cardPda,
      })
      .rpc();

    const session = await fetchSession(sessionPda);
    expect(session.healthB).to.equal(TEST_CONSTANTS.initialHealth - 30);
    expect(session.roundDamageA).to.equal(30);
    expect(session.gameScoreA).to.equal(100);
    expect(session.totalPlays).to.equal(1);
  });

  it("applies a heal effect without exceeding max health", async () => {
    const { sessionPda, playerA, playerB } = await createSession();
    const attackCard = await registerEffectCard({
      sessionPda,
      cardIndex: 0,
      owner: playerB.publicKey,
      effectType: TEST_CONSTANTS.effectAttack,
      maxValue: 30,
    });
    const healCard = await registerEffectCard({
      sessionPda,
      cardIndex: 1,
      owner: playerA.publicKey,
      effectType: TEST_CONSTANTS.effectHeal,
      maxValue: 20,
    });
    await activateSession(sessionPda);

    await program.methods
      .applyCardEffect(30, 50)
      .accounts({
        authority: authority.publicKey,
        battleSession: sessionPda,
        registeredCard: attackCard.cardPda,
      })
      .rpc();

    await program.methods
      .applyCardEffect(20, 25)
      .accounts({
        authority: authority.publicKey,
        battleSession: sessionPda,
        registeredCard: healCard.cardPda,
      })
      .rpc();

    const session = await fetchSession(sessionPda);
    expect(session.healthA).to.equal(TEST_CONSTANTS.initialHealth - 10);
    expect(session.gameScoreA).to.equal(25);
    expect(session.gameScoreB).to.equal(50);
  });

  it("rejects effect value exceeding max", async () => {
    const { sessionPda, playerA } = await createSession();
    const { cardPda } = await registerEffectCard({
      sessionPda,
      cardIndex: 0,
      owner: playerA.publicKey,
      effectType: TEST_CONSTANTS.effectAttack,
      maxValue: 50,
    });
    await activateSession(sessionPda);

    await expectAnchorError(
      program.methods
        .applyCardEffect(60, 100)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
          registeredCard: cardPda,
        })
        .rpc(),
      "InvalidEffectValue"
    );
  });

  it("rejects score delta exceeding max", async () => {
    const { sessionPda, playerA } = await createSession();
    const { cardPda } = await registerEffectCard({
      sessionPda,
      cardIndex: 0,
      owner: playerA.publicKey,
      effectType: TEST_CONSTANTS.effectNone,
      maxValue: 0,
    });
    await activateSession(sessionPda);

    await expectAnchorError(
      program.methods
        .applyCardEffect(0, TEST_CONSTANTS.maxScoreDelta + 1)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
          registeredCard: cardPda,
        })
        .rpc(),
      "InvalidScoreDelta"
    );
  });

  it("prevents replay with the same effect card", async () => {
    const { sessionPda, playerA } = await createSession();
    const { cardPda } = await registerEffectCard({
      sessionPda,
      cardIndex: 2,
      owner: playerA.publicKey,
      effectType: TEST_CONSTANTS.effectAttack,
      maxValue: 35,
    });
    await activateSession(sessionPda);

    await program.methods
      .applyCardEffect(25, 80)
      .accounts({
        authority: authority.publicKey,
        battleSession: sessionPda,
        registeredCard: cardPda,
      })
      .rpc();

    await expectAnchorError(
      program.methods
        .applyCardEffect(25, 80)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
          registeredCard: cardPda,
        })
        .rpc(),
      "CardAlreadyUsed"
    );
  });

  it("awards the round after an effect-based KO", async () => {
    const { sessionPda, playerA } = await createSession();
    const { cardPda } = await registerEffectCard({
      sessionPda,
      cardIndex: 3,
      owner: playerA.publicKey,
      effectType: TEST_CONSTANTS.effectAttack,
      maxValue: 100,
    });
    await activateSession(sessionPda);

    await program.methods
      .applyCardEffect(100, 150)
      .accounts({
        authority: authority.publicKey,
        battleSession: sessionPda,
        registeredCard: cardPda,
      })
      .rpc();

    const session = await fetchSession(sessionPda);
    expect(session.scoreA).to.equal(1);
    expect(session.roundsWonA).to.equal(1);
    expect(session.currentRound).to.equal(2);
    expect(session.healthA).to.equal(TEST_CONSTANTS.initialHealth);
    expect(session.healthB).to.equal(TEST_CONSTANTS.initialHealth);
  });
});
