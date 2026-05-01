import { Hono } from 'hono';

export const actionsRouter = new Hono();

// ---------------------------------------------------------------------------
// Solana Actions & Blinks Middleware
// Spec: https://solana.com/docs/advanced/actions#options-response
// All Action endpoints MUST return these CORS headers for GET, POST & OPTIONS.
// ---------------------------------------------------------------------------
actionsRouter.use('/*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  c.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Content-Encoding, Accept-Encoding, X-Action-Version, X-Blockchain-Ids',
  );
  c.header('Access-Control-Expose-Headers', 'X-Action-Version, X-Blockchain-Ids');
  c.header('X-Action-Version', '2.1.3');
  c.header('X-Blockchain-Ids', 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1');  // Solana Devnet

  if (c.req.method === 'OPTIONS') {
    return c.text('OK', 200);
  }

  await next();
});

// ---------------------------------------------------------------------------
// GET /api/actions/challenge — Action metadata (renders the Blink on X)
//
// Spec reference — GET Response Body:
//   type, icon, title, description, label, disabled?, links?, error?
// LinkedAction:
//   type, href, label, parameters?
// ---------------------------------------------------------------------------
actionsRouter.get('/challenge', (c) => {
  // Absolute URL required for Blink renderers.
  // For production, swap with your deployed domain URL.
  const iconUrl =
    'https://arweave.net/qN7Xy_CgGf2Y-DItf-Bf0iV9Wl80S-c4m2rV6Q5S3j0';

  const payload = {
    type: 'action' as const,
    icon: iconUrl,
    title: 'CORA — Challenge Me ⚔️',
    description:
      'Wager your tokens in a high-stakes aptitude battle! ' +
      'Match instantly, prove your logic skills, and take the pot. ' +
      '97.5% to the winner — powered by Solana.',
    label: 'Deposit & Play',  // fallback label when no links.actions
    links: {
      actions: [
        {
          type: 'transaction' as const,
          label: 'Stake 5 USDC',
          href: '/api/actions/challenge?amount=5',
        },
        {
          type: 'transaction' as const,
          label: 'Stake 10 USDC',
          href: '/api/actions/challenge?amount=10',
        },
        {
          type: 'transaction' as const,
          label: 'Stake 25 USDC',
          href: '/api/actions/challenge?amount=25',
        },
        {
          type: 'transaction' as const,
          label: 'Custom Stake',
          href: '/api/actions/challenge?amount={amount}',
          parameters: [
            {
              type: 'number' as const,
              name: 'amount',
              label: 'Enter stake amount (USDC)',
              required: true,
              min: 1,
              max: 1000,
              patternDescription: 'Enter a number between 1 and 1000',
            },
          ],
        },
      ],
    },
  };

  return c.json(payload);
});

// ---------------------------------------------------------------------------
// POST /api/actions/challenge — Build unsigned Solana transaction (base64)
//
// Spec reference — POST Request Body:
//   { "account": "<base58 pubkey>" }
// POST Response Body:
//   { "transaction": "<base64>", "message"?: string }
//
// The wallet will set feePayer, recentBlockhash, sign and submit.
// ---------------------------------------------------------------------------
actionsRouter.post('/challenge', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const account: string | undefined = body.account;
    const queryAmount = c.req.query('amount');
    const amount = queryAmount || body.amount || '10';

    if (!account) {
      return c.json(
        { message: 'Missing `account` in POST body (base58 public key)' } satisfies ActionError,
        400,
      );
    }

    // Build a minimal Memo transaction.
    // In a production flow this would call initialize_match + deposit_wager
    // on the Anchor escrow program. For now, the Memo tx proves the Blink
    // pipeline is working end-to-end while we wire the real escrow later.
    const { Connection, PublicKey, Transaction, TransactionInstruction } =
      await import('@solana/web3.js');

    const RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const conn = new Connection(RPC, 'confirmed');
    const latest = await conn.getLatestBlockhash();

    const tx = new Transaction({
      recentBlockhash: latest.blockhash,
      feePayer: new PublicKey(account),
    });

    const memoProgramId = new PublicKey(
      'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
    );
    const memoPayload = JSON.stringify({
      app: 'cora',
      action: 'challenge',
      amount: String(amount),
    });
    const memoIx = new TransactionInstruction({
      programId: memoProgramId,
      keys: [],
      data: Buffer.from(memoPayload, 'utf8'),
    });

    tx.add(memoIx);

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const base64 = serialized.toString('base64');

    return c.json({
      transaction: base64,
      message: `Stake ${amount} USDC and enter the CORA arena!`,
    });
  } catch (err) {
    console.error('[actions/challenge POST] Failed to build transaction', err);
    return c.json(
      { message: 'Internal error — failed to build transaction' } satisfies ActionError,
      500,
    );
  }
});

// ---------------------------------------------------------------------------
// Lightweight error shape matching the Solana Actions spec (ActionError)
// ---------------------------------------------------------------------------
interface ActionError {
  message: string;
}
