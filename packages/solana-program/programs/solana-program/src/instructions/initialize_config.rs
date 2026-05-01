use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::ProgramConfig;

/// One-time setup: creates the global config PDA that stores the treasury
/// authority. Only the deployer (payer) can call this, and the PDA seed
/// ensures it can only ever exist once.
pub fn handler(ctx: Context<InitializeConfig>, treasury_authority: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.treasury_authority = treasury_authority;
    config.bump = ctx.bumps.config;

    msg!("CORA: Config initialized");
    msg!("Admin: {}", config.admin);
    msg!("Treasury authority: {}", config.treasury_authority);

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = ProgramConfig::LEN,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, ProgramConfig>,

    pub system_program: Program<'info, System>,
}
