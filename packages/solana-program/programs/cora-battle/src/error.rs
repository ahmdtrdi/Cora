use anchor_lang::prelude::*;

#[error_code]
pub enum BattleError {
    #[msg("Session is not in the expected status")]
    InvalidStatus,

    #[msg("Player is not a participant in this session")]
    UnauthorizedPlayer,

    #[msg("Card does not belong to this session")]
    UnregisteredCard,

    #[msg("Only the session authority can perform this action")]
    UnauthorizedAuthority,

    #[msg("Session has already finished")]
    AlreadyFinished,

    #[msg("Player A and Player B cannot be the same address")]
    SamePlayer,

    #[msg("Card has already been used in this session")]
    CardAlreadyUsed,

    #[msg("Damage value is out of allowed range")]
    InvalidDamage,

    #[msg("Target must be a participant in this session")]
    InvalidTarget,

    #[msg("Session timeout has not been reached yet")]
    TimeoutNotReached,

    #[msg("Session has expired due to timeout")]
    SessionExpired,

    #[msg("Arithmetic overflow in game state calculation")]
    ArithmeticOverflow,
}
