use anchor_lang::prelude::*;
use crate::constants::*;
use crate::error::CoraError;
use crate::state::ProgramConfig;

/// Allows the current admin to update the treasury authority.
/// This enables rotating the treasury wallet without redeploying.
pub fn handler(ctx: Context<UpdateConfig>, new_treasury_authority: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.treasury_authority = new_treasury_authority;

    msg!("CORA: Treasury authority updated to {}", new_treasury_authority);

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        constraint = admin.key() == config.admin @ CoraError::UnauthorizedAdmin
    )]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, ProgramConfig>,
}
