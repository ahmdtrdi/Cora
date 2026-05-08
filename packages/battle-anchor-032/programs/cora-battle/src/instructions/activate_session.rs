use crate::constants::*;
use crate::error::BattleError;
use crate::events::SessionActivatedEvent;
use crate::state::{BattleSession, BattleStatus};
use anchor_lang::prelude::*;

/// Transitions the session from WaitingCards → Active.
/// Called by the authority after all cards have been registered.
pub fn handler(ctx: Context<ActivateSession>) -> Result<()> {
    let session = &mut ctx.accounts.battle_session;

    require!(
        session.status == BattleStatus::WaitingCards,
        BattleError::InvalidStatus
    );

    let now = Clock::get()?.unix_timestamp;
    let round_deadline = now
        .checked_add(ROUND_DURATION_SECONDS)
        .ok_or(BattleError::ArithmeticOverflow)?;

    session.status = BattleStatus::Active;
    session.current_round = 1;
    session.round_started_at = now;
    session.round_deadline = round_deadline;

    emit!(SessionActivatedEvent {
        session: session.key(),
        match_id: session.match_id,
        current_round: session.current_round,
        round_deadline,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ActivateSession<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        constraint = battle_session.authority == authority.key()
            @ BattleError::UnauthorizedAuthority,
        seeds = [BATTLE_SEED, battle_session.match_id.as_ref()],
        bump = battle_session.bump,
    )]
    pub battle_session: Account<'info, BattleSession>,
}
