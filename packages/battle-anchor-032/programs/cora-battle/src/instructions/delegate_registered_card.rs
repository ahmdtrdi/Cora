use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::constants::*;
use crate::error::BattleError;
use crate::state::BattleSession;

pub fn handler(ctx: Context<DelegateRegisteredCard>, card_id: [u8; 16]) -> Result<()> {
    let session = &ctx.accounts.battle_session;

    require_keys_eq!(
        session.authority,
        ctx.accounts.payer.key(),
        BattleError::UnauthorizedAuthority
    );

    ctx.accounts.delegate_registered_card(
        &ctx.accounts.payer,
        &[CARD_SEED, session.key().as_ref(), card_id.as_ref()],
        DelegateConfig {
            validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
            ..Default::default()
        },
    )?;

    Ok(())
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateRegisteredCard<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        constraint = battle_session.authority == payer.key()
            @ BattleError::UnauthorizedAuthority,
    )]
    pub battle_session: Account<'info, BattleSession>,
    /// CHECK: The MagicBlock delegation program validates the PDA and rewrites ownership.
    #[account(mut, del)]
    pub registered_card: AccountInfo<'info>,
}
