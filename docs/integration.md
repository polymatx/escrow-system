# Integration Guide

This guide explains how to integrate the Escrow System into your Solana programs and applications.

## For Solana Programs (CPI)

Other Solana programs can call the Escrow System via Cross-Program Invocation (CPI).

### Step 1: Add Dependency

In your program's `Cargo.toml`:

```toml
[dependencies]
escrow-system = { git = "https://github.com/polymatx/escrow-system", features = ["cpi"] }
```

### Step 2: Import and Use

```rust
use anchor_lang::prelude::*;
use escrow_system::cpi::accounts::{InitializeEscrow, Deposit, Release};
use escrow_system::cpi::{initialize_escrow, deposit, release};
use escrow_system::program::EscrowSystem;

#[program]
pub mod your_marketplace {
    use super::*;

    /// Create an order with escrow protection
    pub fn create_protected_order(
        ctx: Context<CreateOrder>,
        amount: u64,
        escrow_seed: u64,
        seller: Pubkey,
    ) -> Result<()> {
        // Call escrow program via CPI
        let cpi_program = ctx.accounts.escrow_program.to_account_info();
        let cpi_accounts = InitializeEscrow {
            escrow: ctx.accounts.escrow.to_account_info(),
            vault: ctx.accounts.vault.to_account_info(),
            buyer: ctx.accounts.buyer.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        initialize_escrow(
            cpi_ctx,
            amount,
            escrow_seed,
            seller,
            "Order protection".to_string(),
            Some(7 * 24 * 3600), // 7 day timeout
        )?;

        msg!("Order created with escrow protection");
        Ok(())
    }

    /// Fund the escrow
    pub fn fund_order(ctx: Context<FundOrder>) -> Result<()> {
        let cpi_program = ctx.accounts.escrow_program.to_account_info();
        let cpi_accounts = Deposit {
            escrow: ctx.accounts.escrow.to_account_info(),
            vault: ctx.accounts.vault.to_account_info(),
            depositor: ctx.accounts.buyer.to_account_info(),
            depositor_token_account: ctx.accounts.buyer_token_account.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        deposit(cpi_ctx)?;

        Ok(())
    }

    /// Complete the order and release funds
    pub fn complete_order(ctx: Context<CompleteOrder>) -> Result<()> {
        let cpi_program = ctx.accounts.escrow_program.to_account_info();
        let cpi_accounts = Release {
            escrow: ctx.accounts.escrow.to_account_info(),
            vault: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
            seller_token_account: ctx.accounts.seller_token_account.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        release(cpi_ctx)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateOrder<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    /// CHECK: Escrow PDA - validated by escrow program
    #[account(mut)]
    pub escrow: UncheckedAccount<'info>,
    
    /// CHECK: Vault PDA - validated by escrow program
    #[account(mut)]
    pub vault: UncheckedAccount<'info>,
    
    pub mint: Account<'info, Mint>,
    
    pub escrow_program: Program<'info, EscrowSystem>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
```

### Step 3: Calculate PDAs

To derive the escrow and vault PDAs:

```rust
use anchor_lang::prelude::*;

// Escrow PDA
let (escrow_pda, _) = Pubkey::find_program_address(
    &[
        b"escrow",
        buyer.key().as_ref(),
        &escrow_seed.to_le_bytes(),
    ],
    &escrow_program_id,
);

// Vault PDA
let (vault_pda, _) = Pubkey::find_program_address(
    &[
        b"vault",
        buyer.key().as_ref(),
        &escrow_seed.to_le_bytes(),
    ],
    &escrow_program_id,
);
```

## Program ID

```
Devnet:  9pZmQesbcR58wxt3bncrm1S615sv2nr3LJYpcah1B6LB
Mainnet: (To be deployed)
```

## Available CPI Functions

| Function | Description |
|----------|-------------|
| `initialize_escrow` | Create a new escrow agreement |
| `deposit` | Fund the escrow with tokens |
| `release` | Release funds to seller |
| `cancel` | Cancel escrow (Initialized state only) |
| `set_arbiter` | Set dispute resolver |
| `update_conditions` | Update release conditions |
| `close_escrow` | Close account and recover rent |

## Use Cases

### 1. NFT Marketplace

```rust
// When someone buys an NFT:
// 1. Create escrow with NFT price
// 2. Buyer deposits funds
// 3. Seller transfers NFT
// 4. Buyer confirms, releases funds
```

### 2. Freelance Platform

```rust
// When someone hires a freelancer:
// 1. Client creates escrow with payment
// 2. Client deposits funds
// 3. Freelancer completes work
// 4. Client approves, releases funds
// 5. Or arbiter resolves disputes
```

### 3. P2P Trading

```rust
// When trading tokens OTC:
// 1. Buyer creates escrow
// 2. Buyer deposits payment tokens
// 3. Seller sends traded tokens
// 4. Buyer confirms, releases payment
```

## Error Handling

Handle escrow errors in your program:

```rust
use escrow_system::error::EscrowError;

match result {
    Err(e) if e == EscrowError::InvalidState.into() => {
        msg!("Escrow is not in the correct state");
    }
    Err(e) if e == EscrowError::UnauthorizedRelease.into() => {
        msg!("Not authorized to release");
    }
    Err(e) => return Err(e),
    Ok(_) => {}
}
```

## Security Considerations

1. **State Validation**: The escrow program validates all state transitions
2. **Signer Checks**: Only authorized parties can perform actions
3. **Rug Pull Protection**: Buyer cannot cancel after funding
4. **Timeout**: Optional auto-release after timeout period

## Support

- GitHub Issues: https://github.com/polymatx/escrow-system/issues
- Documentation: https://github.com/polymatx/escrow-system/tree/main/docs

