// @ts-nocheck
import {
  activateSession,
  authority,
  createSession,
  expectAnchorError,
  program,
} from "./helpers/battleTestUtils";

describe("resolve_round_by_state", () => {
  it("rejects when the session is not active", async () => {
    const { sessionPda } = await createSession();

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

  it("rejects before the round deadline", async () => {
    const { sessionPda } = await createSession();
    await activateSession(sessionPda);

    await expectAnchorError(
      program.methods
        .resolveRoundByState()
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "TimeoutNotReached"
    );
  });
});
