// @ts-nocheck
import {
  activateSession,
  authority,
  createSession,
  expectAnchorError,
  program,
} from "./helpers/battleTestUtils";

describe("timeout_player_for_round", () => {
  it("rejects when the session is not active", async () => {
    const { sessionPda, playerA } = await createSession();

    await expectAnchorError(
      program.methods
        .timeoutPlayerForRound(playerA.publicKey)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "InvalidStatus"
    );
  });

  it("rejects before the round deadline", async () => {
    const { sessionPda, playerA } = await createSession();
    await activateSession(sessionPda);

    await expectAnchorError(
      program.methods
        .timeoutPlayerForRound(playerA.publicKey)
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "TimeoutNotReached"
    );
  });
});
