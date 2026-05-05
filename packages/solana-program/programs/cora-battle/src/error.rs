use anchor_lang::prelude::*;

#[error_code]
pub enum BattleError {
    #[msg("Session is not active")]
    NotActive,
    #[msg("Player is not a participant")]
    UnauthorizedPlayer,
    #[msg("Card not registered")]
    UnregisteredCard,
    #[msg("Invalid answer")]
    InvalidAnswer,
    #[msg("Match already finished")]
    AlreadyFinished,
}
