#!/bin/bash

# Create keypairs for testing
mkdir -p keypairs

echo "🔑 Creating test keypairs..."

# Create buyer keypair
solana-keygen new --no-bip39-passphrase --silent --outfile keypairs/buyer.json
BUYER=$(solana-keygen pubkey keypairs/buyer.json)

# Create seller keypair
solana-keygen new --no-bip39-passphrase --silent --outfile keypairs/seller.json
SELLER=$(solana-keygen pubkey keypairs/seller.json)

# Create arbiter keypair
solana-keygen new --no-bip39-passphrase --silent --outfile keypairs/arbiter.json
ARBITER=$(solana-keygen pubkey keypairs/arbiter.json)

echo "✅ Keypairs created:"
echo "Buyer: $BUYER"
echo "Seller: $SELLER"
echo "Arbiter: $ARBITER"

# Make scripts executable
chmod +x scripts/*.sh
