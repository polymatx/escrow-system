#!/bin/bash
set -e

# Parse command line arguments
CLUSTER="localnet"
if [ $# -eq 1 ]; then
    CLUSTER=$1
fi

echo "🚀 Deploying to $CLUSTER..."

# Set cluster
solana config set --url $CLUSTER

# Ensure sufficient balance
if [ "$CLUSTER" = "devnet" ] || [ "$CLUSTER" = "mainnet" ]; then
    BALANCE=$(solana balance --output json | jq -r '.value')
    if (( $(echo "$BALANCE < 2" | bc -l) )); then
        echo "❌ Insufficient balance. Need at least 2 SOL for deployment."
        if [ "$CLUSTER" = "devnet" ]; then
            echo "💰 Airdropping SOL for devnet deployment..."
            solana airdrop 2
        else
            echo "Please fund your wallet with SOL for mainnet deployment."
            exit 1
        fi
    fi
fi

# Build program
echo "🔨 Building program..."
anchor build

# Deploy program
echo "📤 Deploying program to $CLUSTER..."
anchor deploy --provider.cluster $CLUSTER

# Verify deployment
PROGRAM_ID=$(cat target/idl/escrow_system.json | jq -r '.metadata.address')
echo "✅ Deployment successful!"
echo "Program ID: $PROGRAM_ID"
echo "Cluster: $CLUSTER"
echo "Explorer: https://explorer.solana.com/address/$PROGRAM_ID?cluster=$CLUSTER"
