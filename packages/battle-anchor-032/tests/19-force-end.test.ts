// @ts-nocheck
import {
  authority,
  createFinishedKoBattle,
  createSession,
  expectAnchorError,
  program,
} from "./helpers/battleTestUtils";

describe("force_end", () => {
  it("rejects force_end before timeout", async () => {
    const { sessionPda } = await createSession();

    await expectAnchorError(
      program.methods
        .forceEnd()
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "TimeoutNotReached"
    );
  });

  it("rejects force_end on a finished session", async () => {
    const { sessionPda } = await createFinishedKoBattle();

    await expectAnchorError(
      program.methods
        .forceEnd()
        .accounts({
          authority: authority.publicKey,
          battleSession: sessionPda,
        })
        .rpc(),
      "InvalidStatus"
    );
  });
});
