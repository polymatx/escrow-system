# API Reference

## EscrowClient Class

The main client class for interacting with the escrow program.

### Constructor

```typescript
new EscrowClient(program: Program<EscrowSystem>, provider: AnchorProvider)
```

### Methods

#### `initializeEscrow(buyer, config, escrowSeed?)`

Creates a new escrow agreement.

**Parameters:**
- `buyer: Keypair` - The buyer's keypair (must sign the transaction)
- `config: EscrowConfig` - Escrow configuration object
- `escrowSeed?: BN` - Optional unique identifier (defaults to timestamp)

**Returns:** `Promise<{ signature: string, escrow: PublicKey, vault: PublicKey, escrowSeed: BN }>`

**Example:**
```typescript
const config = {
  amount: new BN(1000000), // 1 token with 6 decimals
  seller: sellerPublicKey,
  mint: usdcMintAddress,
  releaseConditions: "Product delivery required",
  timeoutDuration: new BN(7 * 24 * 3600), // 7 days
};

const result = await escrowClient.initializeEscrow(buyerKeypair, config);
```

#### `deposit(buyer, escrow, mint)`

Deposits funds into an existing escrow.

**Parameters:**
- `buyer: Keypair` - The buyer's keypair
- `escrow: PublicKey` - The escrow account address
- `mint: PublicKey` - The token mint address

**Returns:** `Promise<string>` - Transaction signature

#### `releaseFunds(authority, escrow)`

Releases escrowed funds to the seller.

**Parameters:**
- `authority: Keypair` - Authorized signer (buyer, seller, or arbiter)
- `escrow: PublicKey` - The escrow account address

**Returns:** `Promise<string>` - Transaction signature

#### `cancelEscrow(authority, escrow)`

Cancels the escrow and returns funds to buyer.

**Parameters:**
- `authority: Keypair` - Authorized signer (buyer or arbiter)
- `escrow: PublicKey` - The escrow account address

**Returns:** `Promise<string>` - Transaction signature

#### `setArbiter(buyer, escrow, arbiter)`

Sets an arbiter for dispute resolution.

**Parameters:**
- `buyer: Keypair` - The buyer's keypair
- `escrow: PublicKey` - The escrow account address
- `arbiter: PublicKey` - The arbiter's public key

**Returns:** `Promise<string>` - Transaction signature

#### `getEscrowInfo(escrow)`

Retrieves detailed information about an escrow.

**Parameters:**
- `escrow: PublicKey` - The escrow account address

**Returns:** `Promise<EscrowInfo>` - Escrow details

#### `getEscrowsForBuyer(buyer)`

Gets all escrows where the specified address is the buyer.

**Parameters:**
- `buyer: PublicKey` - The buyer's public key

**Returns:** `Promise<EscrowInfo[]>` - Array of escrow information

#### `getEscrowsForSeller(seller)`

Gets all escrows where the specified address is the seller.

**Parameters:**
- `seller: PublicKey` - The seller's public key

**Returns:** `Promise<EscrowInfo[]>` - Array of escrow information

## Types

### EscrowConfig

```typescript
interface EscrowConfig {
  amount: BN;              // Amount to escrow
  seller: PublicKey;       // Seller's address
  mint: PublicKey;         // Token mint address
  releaseConditions: string; // Human-readable conditions
  timeoutDuration?: BN;    // Optional timeout in seconds
}
```

### EscrowInfo

```typescript
interface EscrowInfo {
  escrow: PublicKey;       // Escrow account address
  vault: PublicKey;        // Token vault address
  buyer: PublicKey;        // Buyer's address
  seller: PublicKey;       // Seller's address
  mint: PublicKey;         // Token mint
  amount: BN;              // Escrowed amount
  state: string;           // Current state
  releaseConditions: string; // Release conditions
  createdAt: BN;           // Creation timestamp
  fundedAt?: BN;           // Funding timestamp
  timeoutAt?: BN;          // Timeout timestamp
  releasedAt?: BN;         // Release timestamp
  cancelledAt?: BN;        // Cancellation timestamp
  arbiter?: PublicKey;     // Arbiter address
}
```

## Events

### EscrowCreated

Emitted when a new escrow is initialized.

```typescript
{
  escrow: PublicKey;
  buyer: PublicKey;
  seller: PublicKey;
  amount: u64;
  mint: PublicKey;
}
```

### EscrowFunded

Emitted when an escrow receives funds.

```typescript
{
  escrow: PublicKey;
  amount: u64;
}
```

### EscrowReleased

Emitted when funds are released to the seller.

```typescript
{
  escrow: PublicKey;
  released_by: PublicKey;
  amount: u64;
}
```

### EscrowCancelled

Emitted when an escrow is cancelled.

```typescript
{
  escrow: PublicKey;
  cancelled_by: PublicKey;
}
```

### ArbiterSet

Emitted when an arbiter is assigned.

```typescript
{
  escrow: PublicKey;
  arbiter: PublicKey;
}
```

### ConditionsUpdated

Emitted when release conditions are modified.

```typescript
{
  escrow: PublicKey;
  conditions: string;
}
```

## Error Codes

| Code | Error | Description |
|------|-------|-------------|
| 6000 | InvalidAmount | Amount must be greater than 0 |
| 6001 | ConditionsTooLong | Conditions exceed 500 characters |
| 6002 | InvalidState | Invalid state for the operation |
| 6003 | UnauthorizedDepositor | Only buyer can deposit |
| 6004 | UnauthorizedRelease | Unauthorized release attempt |
| 6005 | UnauthorizedCancel | Unauthorized cancel attempt |
| 6006 | UnauthorizedArbiter | Only buyer can set arbiter |
| 6007 | UnauthorizedUpdate | Only buyer can update conditions |
| 6008 | UnauthorizedClose | Only buyer can close escrow |
