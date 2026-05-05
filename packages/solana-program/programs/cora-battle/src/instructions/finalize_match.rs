use anchor_lang::prelude::*;
use crate::state::{BattleSession, BattleStatus};
use crate::error::BattleError;

/// Called by server after ER commits to mainchain.
/// Emits winner for settlement oracle to pick up.
pub fn handler(ctx: Context<FinalizeMatch>) -> Result<()> {
    let session = &ctx.accounts.battle_session;
    require!(session.status == BattleStatus::Finished, BattleError::NotActive);

    msg!("Battle finalized. Winner: {}", session.winner);

    // Event for settlement oracle to listen to
    emit!(BattleFinalized {
        match_id: session.match_id,
        winner: session.winner,
        score_a: session.score_a,
        score_b: session.score_b,
        rounds_won_a: session.rounds_won_a,
        rounds_won_b: session.rounds_won_b,
    });

    Ok(())
}

#[event]
pub struct BattleFinalized {
    pub match_id: [u8; 32],
    pub winner: Pubkey,
    pub score_a: u16,
    pub score_b: u16,
    pub rounds_won_a: u8,
    pub rounds_won_b: u8,
}

#[derive(Accounts)]
pub struct FinalizeMatch<'info> {
    pub authority: Signer<'info>,
    #[account(
        seeds = [b"battle", battle_session.match_id.as_ref()],
        bump = battle_session.bump,
    )]
    pub battle_session: Account<'info, BattleSession>,
}
