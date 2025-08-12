#!/bin/bash
set -e

# Project health check script
# Verifies all components are working correctly

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ISSUES_FOUND=0

echo -e "${BLUE}🏥 Solana Escrow System - Health Check${NC}"
echo "======================================"

# Function to report issues
report_issue() {
    echo -e "${RED}❌ $1${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
}

report_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

report_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

# Check 1: Prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

if command -v rustc &> /dev/null; then
    report_success "Rust installed: $(rustc --version)"
else
    report_issue "Rust not installed"
fi

if command -v solana &> /dev/null; then
    report_success "Solana CLI installed: $(solana --version)"
else
    report_issue "Solana CLI not installed"
fi

if command -v anchor &> /dev/null; then
    report_success "Anchor installed: $(anchor --version)"
else
    report_issue "Anchor not installed"
fi

if command -v node &> /dev/null; then
    report_success "Node.js installed: $(node --version)"
else
    report_issue "Node.js not installed"
fi

# Check 2: Project structure
echo -e "\n${BLUE}📁 Checking project structure...${NC}"

required_files=(
    "Anchor.toml"
    "Cargo.toml"
    "package.json"
    "programs/escrow-system/src/lib.rs"
    "tests/escrow-system.ts"
    "client/escrow-client.ts"
)

for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        report_success "Found: $file"
    else
        report_issue "Missing: $file"
    fi
done

# Check 3: Dependencies
echo -e "\n${BLUE}📦 Checking dependencies...${NC}"

if [[ -d "node_modules" ]]; then
    report_success "Node modules installed"
else
    report_warning "Node modules not installed - run 'yarn install'"
fi

if [[ -f "Cargo.lock" ]]; then
    report_success "Rust dependencies resolved"
else
    report_warning "Cargo.lock not found - run 'anchor build'"
fi

# Check 4: Configuration
echo -e "\n${BLUE}⚙️ Checking configuration...${NC}"

# Check Solana config
if solana config get &> /dev/null; then
    CLUSTER=$(solana config get | grep 'RPC URL' | awk '{print $3}')
    KEYPAIR=$(solana config get | grep 'Keypair Path' | awk '{print $3}')
    report_success "Solana configured - Cluster: $CLUSTER"
    
    if [[ -f "$KEYPAIR" ]]; then
        report_success "Keypair exists: $KEYPAIR"
        
        # Check balance if connected to network
        if solana balance &> /dev/null; then
            BALANCE=$(solana balance)
            report_success "Wallet balance: $BALANCE"
        else
            report_warning "Cannot check balance - network might be down"
        fi
    else
        report_issue "Keypair not found: $KEYPAIR"
    fi
else
    report_issue "Solana CLI not configured"
fi

# Check 5: Build system
echo -e "\n${BLUE}🔨 Checking build system...${NC}"

if anchor build &> /dev/null; then
    report_success "Program builds successfully"
    
    # Check program ID consistency
    if [[ -f "target/deploy/escrow_system-keypair.json" ]]; then
        EXPECTED_ID=$(solana-keygen pubkey target/deploy/escrow_system-keypair.json)
        DECLARED_ID=$(grep -o 'declare_id!(".*")' programs/escrow-system/src/lib.rs | grep -o '".*"' | tr -d '"')
        
        if [[ "$EXPECTED_ID" == "$DECLARED_ID" ]]; then
            report_success "Program ID consistent: $EXPECTED_ID"
        else
            report_issue "Program ID mismatch - Expected: $EXPECTED_ID, Declared: $DECLARED_ID"
        fi
    else
        report_warning "Program keypair not found - will be generated on first build"
    fi
else
    report_issue "Program build failed"
fi

# Check 6: Test system
echo -e "\n${BLUE}🧪 Checking test system...${NC}"

if [[ -f "tests/escrow-system.ts" ]]; then
    # Quick syntax check
    if npx tsc --noEmit tests/escrow-system.ts &> /dev/null; then
        report_success "Test files compile correctly"
    else
        report_issue "Test files have TypeScript errors"
    fi
else
    report_issue "Test file missing"
fi

# Check if test validator is needed and available
if command -v solana-test-validator &> /dev/null; then
    report_success "Test validator available"
else
    report_warning "Test validator not found - some tests may fail"
fi

# Check 7: Security
echo -e "\n${BLUE}🛡️ Checking security...${NC}"

# Check for common security files
if [[ -f ".gitignore" ]]; then
    if grep -q "*.json" .gitignore && grep -q "keypairs/" .gitignore; then
        report_success "Keypairs excluded from Git"
    else
        report_warning "Keypairs might not be excluded from Git"
    fi
else
    report_issue ".gitignore missing"
fi

# Check for hardcoded keys (basic check)
if grep -r "private_key\|secret_key\|keypair.*=" . --exclude-dir=node_modules --exclude-dir=target --exclude="*.md" &> /dev/null; then
    report_warning "Potential hardcoded keys found - please review"
else
    report_success "No obvious hardcoded keys found"
fi

# Summary
echo -e "\n${BLUE}📊 Health Check Summary${NC}"
echo "======================="

if [[ $ISSUES_FOUND -eq 0 ]]; then
    echo -e "${GREEN}🎉 All checks passed! Your project is healthy.${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Run 'make test' to verify functionality"
    echo "2. Run 'make deploy-local' to test deployment"
    echo "3. Try 'make example' to see it in action"
    echo "4. Review docs/ for detailed guides"
    exit 0
else
    echo -e "${RED}⚠️ Found $ISSUES_FOUND issues that need attention.${NC}"
    echo ""
    echo -e "${BLUE}Recommended actions:${NC}"
    echo "1. Fix the issues listed above"
    echo "2. Run this health check again"
    echo "3. Consult the troubleshooting guide in docs/"
    exit 1
fi
