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
  setCardManifest,
  surrenderMatch,
} from "./helpers/battleTestUtils";

async function createSurrenderableBattle() {
  const session = await createSession();
  await setCardManifest({
    sessionPda: session.sessionPda,
    isPlayerA: true,
    entries: [{ effectType: TEST_CONSTANTS.effectAttack, maxValue: 150 }],
  });
  await setCardManifest({
    sessionPda: session.sessionPda,
    isPlayerA: false,
    entries: [{ effectType: TEST_CONSTANTS.effectHeal, maxValue: 30 }],
  });
  await activateSession(session.sessionPda);
  return session;
}

describe("surrender_match", () => {
  it("finishes the match immediately when player A surrenders", async () => {
    const { sessionPda, playerA, playerB } = await createSurrenderableBattle();

    await surrenderMatch({
      sessionPda,
      surrenderingPlayer: playerA.publicKey,
    });

    const session = await fetchSession(sessionPda);
    expect(session.winner.toBase58()).to.equal(playerB.publicKey.toBase58());
    expect(session.endReason).to.equal(TEST_CONSTANTS.endReasonSurrender);
    expect(session.finishedAt.toNumber()).to.be.greaterThan(0);
    expect(Object.keys(session.status)[0]).to.equal("finished");
  });

  it("finishes the match immediately when player B surrenders", async () => {
    const { sessionPda, playerA, playerB } = await createSurrenderableBattle();

    await surrenderMatch({
      sessionPda,
      surrenderingPlayer: playerB.publicKey,
    });

    const session = await fetchSession(sessionPda);
    expect(session.winner.toBase58()).to.equal(playerA.publicKey.toBase58());
    expect(session.endReason).to.equal(TEST_CONSTANTS.endReasonSurrender);
  });

  it("rejects surrender for non-participants and blocks further gameplay mutations", async () => {
    const { sessionPda, playerA } = await createSurrenderableBattle();
    const outsider = await createSession();

    await expectAnchorError(
      program.methods
        .surrenderMatch(outsider.playerA.publicKey)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "InvalidSurrenderPlayer"
    );

    await surrenderMatch({
      sessionPda,
      surrenderingPlayer: playerA.publicKey,
    });

    await expectAnchorError(
      program.methods
        .applyEffect(0, true, 50, 100)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "InvalidStatus"
    );

    await expectAnchorError(
      program.methods
        .resolveRoundByState()
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "InvalidStatus"
    );
  });
});
