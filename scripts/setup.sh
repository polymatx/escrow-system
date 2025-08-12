#!/bin/bash
set -e

echo "🚀 Setting up Solana Escrow System..."

# Create keypairs directory
mkdir -p keypairs

# Check if Solana config exists, create if not
if [ ! -f ~/.config/solana/id.json ]; then
    echo "📝 Creating Solana keypair..."
    solana-keygen new --no-bip39-passphrase --silent --outfile ~/.config/solana/id.json
fi

# Configure Solana for localnet
echo "⚙️ Configuring Solana CLI..."
solana config set --url localhost
solana config set --keypair ~/.config/solana/id.json

# Check if localnet is running, start if not
if ! solana cluster-version &>/dev/null; then
    echo "🖥️ Starting Solana localnet..."
    solana-test-validator --reset &
    sleep 5
fi

# Airdrop SOL for testing
echo "💰 Airdropping SOL for testing..."
solana airdrop 10

# Build the program
echo "🔨 Building program..."
anchor build

# Generate program keypair if it doesn't exist
PROGRAM_KEYPAIR="target/deploy/escrow_system-keypair.json"
if [ ! -f "$PROGRAM_KEYPAIR" ]; then
    echo "🔑 Generating program keypair..."
    solana-keygen new --no-bip39-passphrase --silent --outfile "$PROGRAM_KEYPAIR"
fi

# Update program ID in lib.rs and Anchor.toml
PROGRAM_ID=$(solana-keygen pubkey "$PROGRAM_KEYPAIR")
echo "📋 Program ID: $PROGRAM_ID"

# Update lib.rs
sed -i '' "s/declare_id!(\".*\")/declare_id!(\"$PROGRAM_ID\")/g" programs/escrow-system/src/lib.rs

# Update Anchor.toml
sed -i '' "s/escrow_system = \".*\"/escrow_system = \"$PROGRAM_ID\"/g" Anchor.toml

echo "✅ Setup complete!"
echo "Program ID: $PROGRAM_ID"
echo "Wallet: $(solana address)"
echo "Balance: $(solana balance) SOL"
