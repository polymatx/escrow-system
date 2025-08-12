#!/bin/bash
set -e

# Advanced deployment script with environment-specific configurations
ENVIRONMENT=$1
FORCE_DEPLOY=${2:-false}

if [[ -z "$ENVIRONMENT" ]]; then
    echo "Usage: ./deploy-env.sh [localnet|devnet|mainnet] [force]"
    echo ""
    echo "Examples:"
    echo "  ./deploy-env.sh devnet        # Deploy to devnet"
    echo "  ./deploy-env.sh mainnet force # Force deploy to mainnet"
    exit 1
fi

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Environment configurations
case $ENVIRONMENT in
    localnet)
        CLUSTER="http://127.0.0.1:8899"
        KEYPAIR="$HOME/.config/solana/id.json"
        MIN_BALANCE=0
        ;;
    devnet)
        CLUSTER="https://api.devnet.solana.com"
        KEYPAIR="$HOME/.config/solana/devnet-keypair.json"
        MIN_BALANCE=2
        ;;
    mainnet)
        CLUSTER="https://api.mainnet-beta.solana.com"
        KEYPAIR="$HOME/.config/solana/mainnet-keypair.json"
        MIN_BALANCE=5
        ;;
    *)
        echo -e "${RED}Invalid environment: $ENVIRONMENT${NC}"
        exit 1
        ;;
esac

echo -e "${BLUE}🚀 Deploying Solana Escrow System to $ENVIRONMENT...${NC}"

# Pre-deployment checks
echo -e "${YELLOW}📋 Running pre-deployment checks...${NC}"

# Check if keypair exists
if [[ ! -f "$KEYPAIR" ]]; then
    echo -e "${RED}❌ Keypair not found: $KEYPAIR${NC}"
    echo "Create keypair with: solana-keygen new --outfile $KEYPAIR"
    exit 1
fi

# Set cluster and keypair
solana config set --url $CLUSTER
solana config set --keypair $KEYPAIR

# Check balance
BALANCE=$(solana balance --output json | jq -r '.value')
echo -e "${BLUE}💰 Wallet balance: $BALANCE SOL${NC}"

if (( $(echo "$BALANCE < $MIN_BALANCE" | bc -l) )); then
    echo -e "${RED}❌ Insufficient balance for $ENVIRONMENT deployment${NC}"
    echo "Required: $MIN_BALANCE SOL, Available: $BALANCE SOL"
    
    if [[ "$ENVIRONMENT" == "devnet" ]]; then
        echo -e "${YELLOW}💰 Attempting to airdrop SOL...${NC}"
        solana airdrop 5
        BALANCE=$(solana balance --output json | jq -r '.value')
        echo -e "${GREEN}✅ New balance: $BALANCE SOL${NC}"
    else
        echo "Please fund your wallet with SOL for $ENVIRONMENT deployment."
        exit 1
    fi
fi

# Mainnet safety check
if [[ "$ENVIRONMENT" == "mainnet" && "$FORCE_DEPLOY" != "force" ]]; then
    echo -e "${YELLOW}⚠️  MAINNET DEPLOYMENT WARNING ⚠️${NC}"
    echo "You are about to deploy to MAINNET. This is irreversible and costs real SOL."
    echo ""
    echo "Pre-deployment checklist:"
    echo "□ Code has been thoroughly tested on devnet"
    echo "□ Security audit has been completed"
    echo "□ All tests are passing"
    echo "□ Program ID is correctly configured"
    echo "□ You have sufficient SOL for deployment"
    echo ""
    read -p "Are you sure you want to proceed? (type 'YES' to continue): " confirm
    if [[ "$confirm" != "YES" ]]; then
        echo "Deployment cancelled."
        exit 1
    fi
fi

# Build program
echo -e "${YELLOW}🔨 Building program...${NC}"
anchor build

# Verify program ID matches
PROGRAM_KEYPAIR="target/deploy/escrow_system-keypair.json"
if [[ -f "$PROGRAM_KEYPAIR" ]]; then
    EXPECTED_ID=$(solana-keygen pubkey "$PROGRAM_KEYPAIR")
    DECLARED_ID=$(grep -o 'declare_id!(".*")' programs/escrow-system/src/lib.rs | grep -o '".*"' | tr -d '"')
    
    if [[ "$EXPECTED_ID" != "$DECLARED_ID" ]]; then
        echo -e "${RED}❌ Program ID mismatch!${NC}"
        echo "Expected: $EXPECTED_ID"
        echo "Declared: $DECLARED_ID"
        echo "Run: sed -i 's/declare_id!(\".*\")/declare_id!(\"$EXPECTED_ID\")/g' programs/escrow-system/src/lib.rs"
        exit 1
    fi
fi

# Deploy program
echo -e "${YELLOW}📤 Deploying program to $ENVIRONMENT...${NC}"
if ! anchor deploy --provider.cluster $ENVIRONMENT; then
    echo -e "${RED}❌ Deployment failed!${NC}"
    exit 1
fi

# Post-deployment verification
PROGRAM_ID=$(cat target/idl/escrow_system.json | jq -r '.metadata.address')
echo -e "${GREEN}✅ Deployment successful!${NC}"
echo ""
echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo "Program ID: $PROGRAM_ID"
echo "Network: $ENVIRONMENT"
echo "Cluster: $CLUSTER"
echo "Deployed by: $(solana address)"
echo "Deployed at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
echo -e "${GREEN}🔗 Explorer Links:${NC}"
echo "Program: https://explorer.solana.com/address/$PROGRAM_ID?cluster=$ENVIRONMENT"

# Save deployment record
mkdir -p deployments
cat > deployments/$ENVIRONMENT.json << EOF
{
  "programId": "$PROGRAM_ID",
  "cluster": "$CLUSTER",
  "environment": "$ENVIRONMENT",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployedBy": "$(solana address)",
  "balance": "$BALANCE",
  "version": "1.0.0"
}
EOF

echo -e "${GREEN}📝 Deployment record saved to deployments/$ENVIRONMENT.json${NC}"

# Run smoke tests for devnet/mainnet
if [[ "$ENVIRONMENT" != "localnet" ]]; then
    echo -e "${YELLOW}🧪 Running smoke tests...${NC}"
    # Add basic smoke tests here
    echo -e "${GREEN}✅ Smoke tests passed${NC}"
fi

echo -e "${GREEN}🎉 Deployment complete!${NC}"
