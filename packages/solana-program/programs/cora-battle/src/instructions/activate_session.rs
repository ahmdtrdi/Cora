use anchor_lang::prelude::*;
use crate::state::{BattleSession, BattleStatus};
use crate::constants::*;
use crate::error::BattleError;
use crate::events::SessionActivatedEvent;

/// Transitions the session from WaitingCards → Active.
/// Called by the authority after all cards have been registered.
pub fn handler(ctx: Context<ActivateSession>) -> Result<()> {
    let session = &mut ctx.accounts.battle_session;

    require!(
        session.status == BattleStatus::WaitingCards,
        BattleError::InvalidStatus
    );

    session.status = BattleStatus::Active;

    emit!(SessionActivatedEvent {
        match_id: session.match_id,
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
