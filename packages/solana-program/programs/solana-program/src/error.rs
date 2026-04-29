use anchor_lang::prelude::*;

#[error_code]
pub enum CoraError {
    #[msg("Wager amount must be greater than zero")]
    InvalidWagerAmount,

    #[msg("Player A and Player B cannot be the same")]
    SamePlayer,

    #[msg("Player is not a participant in this match")]
    UnauthorizedPlayer,

    #[msg("Player has already deposited")]
    AlreadyDeposited,

    #[msg("Match is not in active status")]
    NotActive,

    #[msg("Match is already settled or refunded")]
    AlreadyFinalized,

    #[msg("Match is not waiting for deposits")]
    NotWaitingDeposit,

    #[msg("Invalid match status for this operation")]
    InvalidMatchStatus,

    #[msg("Invalid action parameter")]
    InvalidAction,

    #[msg("Invalid settlement signature")]
    InvalidSignature,

    #[msg("Winner must be a match participant")]
    InvalidWinner,

    #[msg("Timeout has not been reached yet")]
    TimeoutNotReached,

    #[msg("Match has not timed out yet")]
    MatchNotTimedOut,

    #[msg("Token mint does not match match state")]
    InvalidTokenMint,

    #[msg("Match state is inconsistent for refund")]
    InvalidRefundState,

    #[msg("Match has already been finalized")]
    MatchAlreadyFinalized,
}

