# Troubleshooting Guide

## Common Issues and Solutions

### Installation Issues

#### 1. Rust Installation Problems

**Error:**
```
rustc: command not found
```

**Solution:**
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Verify installation
rustc --version
```

#### 2. Solana CLI Issues

**Error:**
```
solana: command not found
```

**Solution:**
```bash
# Install Solana CLI
curl -sSfL https://release.solana.com/v1.18.18/install | sh
export PATH="/home/$(whoami)/.local/share/solana/install/active_release/bin:$PATH"

# Add to your shell profile
echo 'export PATH="/home/$(whoami)/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.bashrc
```

#### 3. Anchor Installation Issues

**Error:**
```
avm: command not found
```

**Solution:**
```bash
# Install Anchor using Cargo
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force

# Install and use latest Anchor
avm install latest
avm use latest

# Verify installation
anchor --version
```

### Build Issues

#### 1. Compilation Errors

**Error:**
```
error[E0433]: failed to resolve: use of undeclared crate or module
```

**Solution:**
```bash
# Clean and rebuild
anchor clean
anchor build

# Check Cargo.toml dependencies
# Ensure all required dependencies are listed
```

#### 2. Program ID Mismatch

**Error:**
```
Error: The program address provided does not match the program address in the ELF
```

**Solution:**
```bash
# Generate new program keypair
solana-keygen new --outfile target/deploy/escrow_system-keypair.json

# Get the new program ID
PROGRAM_ID=$(solana-keygen pubkey target/deploy/escrow_system-keypair.json)

# Update lib.rs
sed -i "s/declare_id!(\".*\")/declare_id!(\"$PROGRAM_ID\")/g" programs/escrow-system/src/lib.rs

# Update Anchor.toml
sed -i "s/escrow_system = \".*\"/escrow_system = \"$PROGRAM_ID\"/g" Anchor.toml

# Rebuild
anchor build
```

### Deployment Issues

#### 1. Insufficient SOL Balance

**Error:**
```
Error: RPC response error -32002: Transaction simulation failed: Attempt to debit an account but found no record of a prior credit.
```

**Solution:**
```bash
# Check current balance
solana balance

# For devnet - airdrop SOL
solana airdrop 5

# For mainnet - transfer SOL from another wallet
# You need at least 2-5 SOL for program deployment
```

#### 2. Network Connection Issues

**Error:**
```
Error: Connection refused (os error 61)
```

**Solution:**
```bash
# For localnet - start test validator
solana-test-validator --reset

# For devnet/mainnet - check network status
solana cluster-version

# Try different RPC endpoint
solana config set --url https://api.devnet.solana.com
```

#### 3. Account Already Exists Error

**Error:**
```
Error: failed to send transaction: Transaction simulation failed: Error processing Instruction 0: custom program error: 0x0
```

**Solution:**
```bash
# For local testing - reset the validator
solana-test-validator --reset

# For live networks - use different program keypair
solana-keygen new --outfile target/deploy/escrow_system-keypair.json
```

### Runtime Issues

#### 1. Transaction Timeout

**Error:**
```
Error: Transaction was not confirmed in 60.00 seconds
```

**Solution:**
```typescript
// Increase timeout in client
const connection = new Connection(rpcUrl, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 120000, // 120 seconds
});

// Or retry with exponential backoff
async function sendTransactionWithRetry(transaction, signers, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await provider.sendAndConfirm(transaction, signers);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
}
```

#### 2. Account Not Found

**Error:**
```
Error: Account does not exist
```

**Solution:**
```typescript
// Check if account exists before fetching
try {
  const escrowAccount = await program.account.escrowAccount.fetch(escrowPda);
} catch (error) {
  if (error.message.includes('Account does not exist')) {
    console.log('Escrow not found - may need to initialize first');
    return null;
  }
  throw error;
}
```

#### 3. Insufficient Token Balance

**Error:**
```
Error: insufficient funds
```

**Solution:**
```typescript
// Check token balance before operations
import { getAccount } from '@solana/spl-token';

const tokenAccount = await getAccount(connection, userTokenAccount);
if (tokenAccount.amount < requiredAmount) {
  throw new Error(`Insufficient balance. Have: ${tokenAccount.amount}, Need: ${requiredAmount}`);
}
```

### Testing Issues

#### 1. Test Failures

**Error:**
```
Error: Account allocation failed: account Address { address: ..., base: None } already in use
```

**Solution:**
```bash
# Use unique seeds for each test
const escrowSeed = new BN(Date.now() + Math.random() * 1000);

# Or reset validator between tests
solana-test-validator --reset
```

#### 2. Timing Issues in Tests

**Error:**
```
AssertionError: expected 'undefined' to not be undefined
```

**Solution:**
```typescript
// Add proper waits for blockchain confirmations
await new Promise(resolve => setTimeout(resolve, 1000));

// Use proper commitment levels in tests
const connection = new Connection('http://localhost:8899', 'confirmed');

// Wait for transaction confirmation
await provider.connection.confirmTransaction(signature, 'confirmed');
```

### Client Integration Issues

#### 1. Wallet Connection Problems

**Error:**
```
Error: Wallet not connected
```

**Solution:**
```typescript
// Check wallet connection before operations
if (!wallet.connected || !wallet.publicKey) {
  throw new Error('Please connect your wallet first');
}

// Handle wallet disconnection gracefully
useEffect(() => {
  if (!wallet.connected) {
    setEscrowClient(null);
    setUserEscrows([]);
  }
}, [wallet.connected]);
```

#### 2. RPC Rate Limiting

**Error:**
```
Error: 429 Too Many Requests
```

**Solution:**
```typescript
// Implement exponential backoff
async function makeRPCCall(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

// Use premium RPC endpoints for production
const connection = new Connection('https://your-premium-rpc-endpoint.com');
```

## Debug Commands

### Program Debugging

```bash
# Get program information
solana program show YOUR_PROGRAM_ID

# View program logs in real-time
solana logs YOUR_PROGRAM_ID

# Get account information
solana account YOUR_ESCROW_ACCOUNT --output json

# Check transaction details
solana confirm TRANSACTION_SIGNATURE -v
```

### Network Debugging

```bash
# Check network status
solana cluster-version

# Check validator status (for localnet)
solana-test-validator --help

# Test network connectivity
solana ping

# Check slot and epoch info
solana epoch-info
```

### Account Debugging

```bash
# List all program accounts
solana program show YOUR_PROGRAM_ID --programs

# Get specific account data
solana account ACCOUNT_ADDRESS --output json-compact

# Check token account details
spl-token account-info TOKEN_ACCOUNT_ADDRESS
```

## Performance Optimization

### 1. Transaction Optimization

```typescript
// Batch instructions when possible
const transaction = new Transaction();
transaction.add(instruction1, instruction2, instruction3);
const signature = await provider.sendAndConfirm(transaction, signers);

// Use appropriate commitment levels
const connection = new Connection(rpcUrl, 'confirmed'); // Faster than 'finalized'
```

### 2. Account Fetching Optimization

```typescript
// Use getMultipleAccounts for batch fetching
const accounts = await connection.getMultipleAccountsInfo([
  escrow1, escrow2, escrow3
]);

// Cache frequently accessed data
const cache = new Map();
const getCachedEscrow = async (escrowId) => {
  if (cache.has(escrowId)) return cache.get(escrowId);
  const escrow = await fetchEscrow(escrowId);
  cache.set(escrowId, escrow);
  return escrow;
};
```

### 3. RPC Optimization

```typescript
// Use premium RPC for production
const rpcEndpoints = {
  development: 'http://localhost:8899',
  devnet: 'https://api.devnet.solana.com',
  mainnet: 'https://your-premium-endpoint.com'
};

// Implement connection pooling
class ConnectionPool {
  private connections: Connection[] = [];
  
  getConnection(): Connection {
    return this.connections[Math.floor(Math.random() * this.connections.length)];
  }
}
```

## Emergency Procedures

### 1. Program Halt (if needed)

```bash
# If critical issue found, halt program (requires upgrade authority)
solana program close YOUR_PROGRAM_ID --bypass-warning
```

### 2. Emergency Fund Recovery

```bash
# If program needs to be drained (extreme case)
# Use the cancel functionality to return funds to users
# This would require coordination with all escrow participants
```

### 3. Incident Response

1. **Identify** the issue scope and impact
2. **Contain** the issue (halt if necessary)
3. **Investigate** root cause
4. **Communicate** with users and stakeholders
5. **Resolve** the issue and deploy fix
6. **Document** the incident and lessons learned

## Security Best Practices for Users

### 1. Wallet Security

- Use hardware wallets for large amounts
- Never share private keys
- Verify transaction details before signing
- Use burner wallets for testing

### 2. Escrow Usage

- Verify seller identity before creating escrow
- Set reasonable timeout periods
- Use arbiters for high-value transactions
- Monitor escrow status regularly

### 3. Smart Contract Interaction

- Always verify program ID
- Double-check all addresses (seller, mint, etc.)
- Start with small amounts for testing
- Understand all conditions before proceeding

## Contact for Security Issues

For security vulnerabilities, please contact:
- **Email**: farid.vosoughi.65@gmail.com
- **PGP Key**: [Your PGP Key]
- **Responsible Disclosure**: We follow responsible disclosure practices

**Please do not report security vulnerabilities through public GitHub issues.**
