use anchor_lang::prelude::*;

#[error_code]
pub enum CoraError {
    #[msg("Wager amount must be greater than zero")]
    InvalidWagerAmount,

    #[msg("Player is not a participant in this match")]
    UnauthorizedPlayer,

    #[msg("Player has already deposited")]
    AlreadyDeposited,

    #[msg("Match is not waiting for deposits")]
    NotWaitingDeposit,

    #[msg("Invalid match status for this operation")]
    InvalidMatchStatus,

    #[msg("Invalid settlement signature")]
    InvalidSignature,

    #[msg("Winner must be a match participant")]
    InvalidWinner,

    #[msg("Timeout has not been reached yet")]
    TimeoutNotReached,

    #[msg("Match has already been finalized")]
    MatchAlreadyFinalized,
}

