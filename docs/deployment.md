# Deployment Guide

## Prerequisites

Before deploying, ensure you have:

- **Solana CLI** installed and configured
- **Anchor CLI** installed (v0.29.0+)
- **Sufficient SOL** for deployment fees
- **Program keypair** generated and secured

## Environment Setup

### 1. Generate Program Keypair

```bash
# Generate a new program keypair
solana-keygen new --outfile ./target/deploy/escrow_system-keypair.json

# Get the program ID
solana-keygen pubkey ./target/deploy/escrow_system-keypair.json
```

### 2. Update Program ID

Update the program ID in these files:
- `programs/escrow-system/src/lib.rs`
- `Anchor.toml`

```rust
// In lib.rs
declare_id!("YOUR_PROGRAM_ID_HERE");
```

```toml
# In Anchor.toml
[programs.devnet]
escrow_system = "YOUR_PROGRAM_ID_HERE"
```

## Local Deployment

### 1. Start Local Validator

```bash
# Start with reset for clean state
solana-test-validator --reset

# Or start with specific configuration
solana-test-validator \
  --reset \
  --ledger .anchor/test-ledger \
  --url https://api.devnet.solana.com \
  --clone metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s
```

### 2. Configure CLI for Local

```bash
solana config set --url localhost
solana config set --keypair ~/.config/solana/id.json
```

### 3. Deploy

```bash
anchor build
anchor deploy
```

## Devnet Deployment

### 1. Configure for Devnet

```bash
solana config set --url devnet
solana config set --keypair ~/.config/solana/devnet-keypair.json
```

### 2. Fund Deployment Wallet

```bash
# Airdrop SOL for deployment
solana airdrop 2

# Verify balance
solana balance
```

### 3. Deploy

```bash
# Build and deploy
anchor build
anchor deploy --provider.cluster devnet

# Verify deployment
solana program show YOUR_PROGRAM_ID --url devnet
```

## Mainnet Deployment

### 1. Security Checklist

Before mainnet deployment:

- [ ] **Complete security audit**
- [ ] **Comprehensive testing** on devnet
- [ ] **Code review** by multiple developers
- [ ] **Penetration testing** completed
- [ ] **Documentation** updated and reviewed
- [ ] **Monitoring** system ready
- [ ] **Emergency procedures** documented

### 2. Prepare Mainnet Wallet

```bash
# Create dedicated mainnet keypair
solana-keygen new --outfile ~/.config/solana/mainnet-keypair.json

# Fund the wallet (requires real SOL)
# Send at least 5-10 SOL to cover deployment and operation costs
```

### 3. Configure for Mainnet

```bash
solana config set --url mainnet-beta
solana config set --keypair ~/.config/solana/mainnet-keypair.json
```

### 4. Final Verification

```bash
# Verify configuration
solana config get

# Check balance
solana balance

# Verify program builds correctly
anchor build

# Test program locally one more time
anchor test
```

### 5. Deploy to Mainnet

```bash
# Deploy to mainnet
anchor deploy --provider.cluster mainnet-beta

# Verify deployment
PROGRAM_ID=$(solana-keygen pubkey target/deploy/escrow_system-keypair.json)
solana program show $PROGRAM_ID --url mainnet-beta
```

### 6. Post-Deployment Steps

```bash
# Set program authority (optional, for upgrades)
solana program set-upgrade-authority $PROGRAM_ID ~/.config/solana/upgrade-authority.json

# Start monitoring
yarn start:monitoring

# Create deployment record
echo "{
  \"programId\": \"$PROGRAM_ID\",
  \"cluster\": \"mainnet-beta\",
  \"deployedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
  \"deployedBy\": \"$(solana address)\"
}" > deployments/mainnet.json
```

## Deployment Costs

### Estimated SOL Requirements

| Environment | Deployment | Operation | Total Recommended |
|-------------|------------|-----------|-------------------|
| Localnet    | Free       | Free      | 0 SOL            |
| Devnet      | Free       | Free      | 0 SOL (airdrop)  |
| Mainnet     | ~2 SOL     | 0.001 SOL/tx | 5-10 SOL        |

### Cost Breakdown (Mainnet)

- **Program Deployment**: ~2 SOL
- **Account Rent**: ~0.002 SOL per escrow
- **Transaction Fees**: ~0.000005 SOL per instruction
- **Emergency Fund**: 3-8 SOL for operations

## Network Configuration

### RPC Endpoints

```bash
# Public endpoints (rate limited)
LOCALNET="http://127.0.0.1:8899"
DEVNET="https://api.devnet.solana.com"
MAINNET="https://api.mainnet-beta.solana.com"

# Premium endpoints (recommended for production)
QUICKNODE="https://your-endpoint.solana-mainnet.quiknode.pro/your-key/"
ALCHEMY="https://solana-mainnet.g.alchemy.com/v2/your-key"
HELIUS="https://mainnet.helius-rpc.com/?api-key=your-key"
```

### Commitment Levels

```typescript
// For different use cases
const commitmentLevels = {
  'processed': 'Fastest, least secure',
  'confirmed': 'Balanced, recommended',
  'finalized': 'Slowest, most secure'
};
```

## Troubleshooting

### Common Deployment Issues

**1. Insufficient SOL**
```
Error: RPC response error -32002: Transaction simulation failed
```
**Solution:** Fund your wallet with more SOL

**2. Program ID Mismatch**
```
Error: The program address provided does not match the program address in the ELF
```
**Solution:** Update program ID in source files and rebuild

**3. Account Already Exists**
```
Error: failed to send transaction: Transaction simulation failed: Error processing Instruction 0: custom program error: 0x0
```
**Solution:** Use `--reset` flag or change program keypair

**4. Network Issues**
```
Error: Connection refused (os error 61)
```
**Solution:** Ensure validator is running or check network connectivity

### Verification Commands

```bash
# Check program deployment
solana program show YOUR_PROGRAM_ID

# Check program logs
solana logs YOUR_PROGRAM_ID

# Test program call
anchor test --skip-local-validator

# Verify account data
solana account YOUR_ESCROW_ACCOUNT --output json
```

## Best Practices

### 1. Security

- Always audit code before mainnet deployment
- Use multi-signature wallets for program authority
- Implement proper access controls
- Test extensively on devnet first

### 2. Performance

- Use commitment level appropriate for your use case
- Batch transactions when possible
- Monitor RPC usage and costs
- Implement proper error handling and retries

### 3. Monitoring

- Set up real-time alerts for failures
- Monitor program account changes
- Track transaction success rates
- Log all important events

### 4. Maintenance

- Plan for program upgrades
- Keep dependencies updated
- Monitor for Solana network changes
- Maintain comprehensive documentation
