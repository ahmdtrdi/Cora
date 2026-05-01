use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::ProgramConfig;

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
