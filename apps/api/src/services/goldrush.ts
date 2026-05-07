import { GoldRushClient } from '@covalenthq/client-sdk';

const apiKey = process.env.GOLDRUSH_API_KEY || 'cqt_dummy';
const client = new GoldRushClient(apiKey);
const chainId = 'solana-devnet';

export interface WalletPlayability {
  playable: boolean;
  reason?: string;
  tokenBalance?: string;
  requiredBalance?: string;
  lastCheckedAt?: string;
  reliable?: boolean;
}

export interface MatchHistoryItem {
  id: string;
  signature: string;
  timestamp: string;
  arenaId: string;
  token: string;
  wagerUsd?: string;
  result?: "win" | "loss" | "draw" | "unknown";
  opponent?: string;
  settlementStatus?: "settled" | "pending" | "failed" | "unknown";
  explorerUrl?: string;
}

/**
 * Check if the wallet holds >= a specific amount of the given token to play.
 * Default required amount could be 1 unit (1 * 10^decimals).
 */
export async function getWalletPlayability(
  address: string,
  arenaId: string,
  tokenMint: string
): Promise<WalletPlayability> {
  try {
    const res = await client.BalanceService.getTokenBalancesForWalletAddress(chainId as any, address, {
      quoteCurrency: 'USD'
    });

    if (res.error) {
      return {
        playable: false,
        reason: `Covalent API error: ${res.error_message}`,
        reliable: false,
        lastCheckedAt: new Date().toISOString(),
      };
    }

    const items = res.data?.items || [];
    
    // Convert to lowercase for safer comparison (sometimes mints are returned differently, though base58 is case sensitive in solana).
    // Usually Covalent for solana returns the contract_address.
    const tokenData = items.find(item => item.contract_address === tokenMint || item.contract_ticker_symbol?.toUpperCase() === tokenMint.toUpperCase());

    const balance = tokenData?.balance || 0n;
    const decimals = tokenData?.contract_decimals || 9;
    
    // Let's assume the required balance is at least some minimal wager like 0.1 tokens.
    // For simplicity, we just verify they have > 0 right now, but you could parameterize this.
    const requiredBalance = 1n; // At least 1 wei/lamport
    
    const playable = balance >= requiredBalance;

    return {
      playable,
      reason: playable ? undefined : "Insufficient token balance",
      tokenBalance: balance.toString(),
      requiredBalance: requiredBalance.toString(),
      lastCheckedAt: new Date().toISOString(),
      reliable: true,
    };
  } catch (err: any) {
    console.error('[GoldRush] getWalletPlayability error:', err.message);
    return {
      playable: false,
      reason: 'Failed to fetch balance',
      reliable: false,
      lastCheckedAt: new Date().toISOString(),
    };
  }
}

/**
 * Fetch the USD price of a specific token mint.
 */
export async function getTokenPriceUsd(tokenMint: string): Promise<number | null> {
  try {
    const res = await client.PricingService.getTokenPrices(chainId as any, 'USD', tokenMint);
    if (res.error || !res.data || res.data.length === 0) {
      return null;
    }
    const priceData = res.data[0];
    return priceData.items?.[0]?.price || null;
  } catch (err: any) {
    console.error('[GoldRush] getTokenPriceUsd error:', err.message);
    return null;
  }
}

/**
 * Fetch the USD value of a specific wager amount.
 * @param tokenMint The SPL token mint address or symbol
 * @param wagerAmount Base unit amount (e.g. lamports)
 * @param decimals Decimals of the token (default 9 for SOL)
 */
export async function getWagerUsdValue(tokenMint: string, wagerAmount: bigint, decimals: number = 9): Promise<string | undefined> {
  const price = await getTokenPriceUsd(tokenMint);
  if (price === null) return undefined;

  // Convert wager amount to human readable format first
  const amountHuman = Number(wagerAmount) / Math.pow(10, decimals);
  const usdValue = amountHuman * price;
  
  return usdValue.toFixed(2);
}

// ----------------- Mocked Endpoints -----------------

function generateMockHistory(arenaId: string, token: string, opponentPrefix: string): MatchHistoryItem[] {
  const now = Date.now();
  return [
    {
      id: `${arenaId}-recent-1`,
      signature: "5R6q...J8k2",
      timestamp: new Date(now - 1000 * 60 * 38).toISOString(),
      arenaId,
      token,
      wagerUsd: "1.50",
      result: "win",
      opponent: `${opponentPrefix}1`,
      settlementStatus: "settled",
    },
    {
      id: `${arenaId}-recent-2`,
      signature: "7Nzf...Q2br",
      timestamp: new Date(now - 1000 * 60 * 95).toISOString(),
      arenaId,
      token,
      wagerUsd: "1.50",
      result: "loss",
      opponent: `${opponentPrefix}2`,
      settlementStatus: "settled",
    },
    {
      id: `${arenaId}-recent-3`,
      signature: "4ddP...rK61",
      timestamp: new Date(now - 1000 * 60 * 180).toISOString(),
      arenaId,
      token,
      wagerUsd: "1.00",
      result: "unknown",
      opponent: `${opponentPrefix}3`,
      settlementStatus: "pending",
    },
  ];
}

export async function getWalletHistory(address: string): Promise<MatchHistoryItem[]> {
  // Stubbed response as requested by the user
  return generateMockHistory("arena-global", "SOL", "opp-");
}

export async function getArenaHistory(arenaId: string): Promise<MatchHistoryItem[]> {
  // Stubbed response as requested by the user
  return generateMockHistory(arenaId, "SOL", "plyr-");
}
