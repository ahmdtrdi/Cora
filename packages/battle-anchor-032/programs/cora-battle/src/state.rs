use anchor_lang::prelude::*;

/// The main battle session account, tracking all on-chain game state.
/// Acts as a "blind HP calculator" — answer verification happens off-chain
/// in the backend, only damage application is recorded on-chain.
#[account]
pub struct BattleSession {
    /// Schema version for forward-compatible upgrades
    pub version: u8,
    /// Unique match identifier (sha256 of match UUID from backend)
    pub match_id: [u8; 32],
    /// The backend oracle authority that controls this session.
    /// Only this signer can register cards, apply damage, and finalize.
    pub authority: Pubkey,
    /// Player A's wallet address
    pub player_a: Pubkey,
    /// Player B's wallet address
    pub player_b: Pubkey,
    /// Player A's current health points (reset each round)
    pub health_a: u16,
    /// Player B's current health points (reset each round)
    pub health_b: u16,
    /// Player A's round score in this best-of-3 battle
    pub score_a: u16,
    /// Player B's round score in this best-of-3 battle
    pub score_b: u16,
    /// Current round number (1-indexed while active, 0 before activation)
    pub current_round: u8,
    /// Rounds won by player A
    pub rounds_won_a: u8,
    /// Rounds won by player B
    pub rounds_won_b: u8,
    /// Unix timestamp when the current round started
    pub round_started_at: i64,
    /// Unix timestamp when the current round may be resolved by timeout
    pub round_deadline: i64,
    /// Rounds missed by player A due to timeout
    pub player_a_missed_rounds: u8,
    /// Rounds missed by player B due to timeout
    pub player_b_missed_rounds: u8,
    /// Total damage events applied (audit trail)
    pub total_plays: u16,
    /// Current battle status (state machine)
    pub status: BattleStatus,
    /// Winner's pubkey (Pubkey::default() until Finished)
    pub winner: Pubkey,
    /// SHA-256 hash of the question set used (fairness proof)
    pub question_hash: [u8; 32],
    /// PDA bump seed
    pub bump: u8,
    /// Unix timestamp when session was created
    pub created_at: i64,
    /// Unix timestamp when session finished (0 if not finished)
    pub finished_at: i64,
    /// Terminal outcome reason. See END_REASON_* constants.
    pub end_reason: u8,
}

impl BattleSession {
    // 8 (disc) + 1 (ver) + 32 (match_id) + 32 (authority) + 32 (player_a)
    // + 32 (player_b) + 2 (hp_a) + 2 (hp_b) + 2 (score_a) + 2 (score_b)
    // + 1 (round) + 1 (won_a) + 1 (won_b) + 8 (round_started)
    // + 8 (round_deadline) + 1 (missed_a) + 1 (missed_b) + 2 (plays)
    // + 1 (status) + 32 (winner) + 32 (q_hash) + 1 (bump)
    // + 8 (created) + 8 (finished) + 1 (end_reason)
    pub const LEN: usize = 8
        + 1
        + 32
        + 32
        + 32
        + 32
        + 2
        + 2
        + 2
        + 2
        + 1
        + 1
        + 1
        + 8
        + 8
        + 1
        + 1
        + 2
        + 1
        + 32
        + 32
        + 1
        + 8
        + 8
        + 1; // = 251
}

/// State machine for battle lifecycle.
/// Transitions: WaitingCards → Active → Finished
///                                    → Cancelled (via force_end)
///              WaitingCards → Cancelled (via force_end)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum BattleStatus {
    /// Session created, waiting for card registration
    WaitingCards,
    /// Cards registered, game in progress
    Active,
    /// Game ended with a winner
    Finished,
    /// Session was cancelled or timed out
    Cancelled,
}

/// A registered card representing one question's damage potential.
/// The card_id uses dummy ephemeral IDs to prevent correlation with
/// real question IDs in the database (privacy via Ephemeral Mapping).
#[account]
pub struct RegisteredCard {
    /// Reference to parent BattleSession PDA
    pub session: Pubkey,
    /// Dummy card identifier for ephemeral mapping
    pub card_id: [u8; 16],
    /// Damage this card deals when the backend confirms a correct answer
    pub damage: u16,
    /// Replay protection — card can only be used once
    pub is_used: bool,
    /// PDA bump seed
    pub bump: u8,
}

impl RegisteredCard {
    // 8 (disc) + 32 (session) + 16 (card_id) + 2 (damage) + 1 (is_used) + 1 (bump)
    pub const LEN: usize = 8 + 32 + 16 + 2 + 1 + 1; // = 60
}
