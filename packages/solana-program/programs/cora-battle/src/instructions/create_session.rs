use anchor_lang::prelude::*;
use crate::state::{BattleSession, BattleStatus};

pub const BATTLE_SEED: &[u8] = b"battle";

pub fn handler(
    ctx: Context<CreateSession>,
    match_id: [u8; 32],
    question_hash: [u8; 32],
) -> Result<()> {
    let session = &mut ctx.accounts.battle_session;
    session.match_id = match_id;
    session.player_a = ctx.accounts.player_a.key();
    session.player_b = ctx.accounts.player_b.key();
    session.health_a = 100;
    session.health_b = 100;
    session.score_a = 0;
    session.score_b = 0;
    session.current_round = 1;
    session.rounds_won_a = 0;
    session.rounds_won_b = 0;
    session.status = BattleStatus::Active;
    session.winner = Pubkey::default();
    session.question_hash = question_hash;
    session.bump = ctx.bumps.battle_session;
    session.created_at = Clock::get()?.unix_timestamp;
    Ok(())
}

#[derive(Accounts)]
#[instruction(match_id: [u8; 32])]
pub struct CreateSession<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: player A pubkey
    pub player_a: UncheckedAccount<'info>,
    /// CHECK: player B pubkey
    pub player_b: UncheckedAccount<'info>,
    #[account(
        init, payer = authority,
        space = BattleSession::LEN,
        seeds = [BATTLE_SEED, match_id.as_ref()],
        bump,
    )]
    pub battle_session: Account<'info, BattleSession>,
    pub system_program: Program<'info, System>,
}
