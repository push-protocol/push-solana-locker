
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke_signed, system_instruction, program::invoke};

declare_id!("FVnnKN3tmbSuWcHbc8anrXZnzETHn96FdaKcJxamrfFx");

#[program]
pub mod pushsolanalocker {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let locker = &mut ctx.accounts.locker;
        locker.admin = ctx.accounts.admin.key();
        locker.bump = ctx.bumps.locker;
        locker.vault_bump = ctx.bumps.vault;
    
        msg!("Locker initialized by {}", locker.admin);
        Ok(())
    }
    

    pub fn add_funds(ctx: Context<AddFunds>, amount: u64, transaction_hash: [u8; 32]) -> Result<()> {
        require!(amount > 0, LockerError::NoFundsSent);

        invoke(
            &system_instruction::transfer(
                ctx.accounts.user.key,
                &ctx.accounts.vault.key(),
                amount,
            ),
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        emit!(FundsAddedEvent {
            user: ctx.accounts.user.key(),
            usdt_amount: amount / 10_000_000,
            transaction_hash,
        });

        Ok(())
    }

    pub fn recover_tokens(ctx: Context<RecoverTokens>, amount: u64) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.admin.key(),
            ctx.accounts.locker_data.admin,
            LockerError::Unauthorized
        );

        let seeds: &[&[u8]; 2] = &[b"vault", &[ctx.accounts.locker_data.vault_bump]];

        invoke_signed(
            &system_instruction::transfer(
                ctx.accounts.vault.key,
                ctx.accounts.recipient.key,
                amount,
            ),
            &[
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.recipient.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[seeds],
        )?;

        emit!(TokenRecoveredEvent {
            admin: ctx.accounts.admin.key(),
            amount,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [b"locker"],
        bump,
        payer = admin,
        space = 8 + 32 + 1 + 1
    )]
    pub locker: Account<'info, Locker>,

    /// CHECK: Native SOL holder, not deserialized
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddFunds<'info> {
    #[account(seeds = [b"locker"], bump = locker.bump)]
    pub locker: Account<'info, Locker>,

    /// CHECK: SOL-only PDA, no data
    #[account(mut, seeds = [b"vault"], bump = locker.vault_bump)]
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecoverTokens<'info> {
    pub locker_data: Account<'info, Locker>,

    /// CHECK: vault PDA used only for lamports
    #[account(mut, seeds = [b"vault"], bump = locker_data.vault_bump)]
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub recipient: Signer<'info>,
    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct Locker {
    pub admin: Pubkey,
    pub bump: u8,
    pub vault_bump: u8,
}

#[error_code]
pub enum LockerError {
    #[msg("No SOL sent")]
    NoFundsSent,

    #[msg("Unauthorized")]
    Unauthorized,
}

#[event]
pub struct FundsAddedEvent {
    pub user: Pubkey,
    pub usdt_amount: u64,
    pub transaction_hash: [u8; 32],
}

#[event]
pub struct TokenRecoveredEvent {
    pub admin: Pubkey,
    pub amount: u64,
}




