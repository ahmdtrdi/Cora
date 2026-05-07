use anchor_lang::prelude::*;
use crate::state::{BattleSession, BattleStatus};
use crate::constants::*;
use crate::error::BattleError;
use crate::events::BattleFinalizedEvent;

/// Called by the authority after the ER commits to mainchain.
/// Emits the BattleFinalizedEvent for the settlement oracle.
/// This is an idempotent read-and-emit — safe to retry on tx failure.
pub fn handler(ctx: Context<FinalizeMatch>) -> Result<()> {
    let session = &ctx.accounts.battle_session;

    require!(
        session.status == BattleStatus::Finished,
        BattleError::InvalidStatus
    );

    msg!("Battle finalized. Winner: {}", session.winner);

    emit!(BattleFinalizedEvent {
        match_id: session.match_id,
        winner: session.winner,
        score_a: session.score_a,
        score_b: session.score_b,
        rounds_won_a: session.rounds_won_a,
        rounds_won_b: session.rounds_won_b,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct FinalizeMatch<'info> {
    pub authority: Signer<'info>,
    #[account(
        constraint = battle_session.authority == authority.key()
            @ BattleError::UnauthorizedAuthority,
        seeds = [BATTLE_SEED, battle_session.match_id.as_ref()],
        bump = battle_session.bump,
    )]
    pub battle_session: Account<'info, BattleSession>,
}
