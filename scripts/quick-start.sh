#!/bin/bash
set -e

# Quick start script for Solana Escrow System

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${PURPLE}"
cat << "EOF"
  ____        _                     _____                               
 / ___|  ___ | | __ _ _ __   __ _   | ____|___  ___ _ __ _____      __   
 \___ \ / _ \| |/ _` | '_ \ / _` |  |  _| / __|/ __| '__/ _ \ \ /\ / /   
  ___) | (_) | | (_| | | | | (_| |  | |___\__ \ (__| | | (_) \ V  V /    
 |____/ \___/|_|\__,_|_| |_|\__,_|  |_____|___/\___|_|  \___/ \_/\_/     
                                                                        
                    _____ ____  ____ ____   _____        __            
                   | ____/ ___||  _ \_   _|/ ____|      / /            
                   |  _| \___ \| |_) || | | |     _    / /             
                   | |___ ___) |  _ < | | | |____| |  / /              
                   |_____|____/|_| \_\|_|  \_____|_| /_/               
                                                                        
EOF
echo -e "${NC}"

echo -e "${BLUE}🚀 Welcome to Solana Escrow System Quick Start!${NC}"
echo "=============================================="
echo ""

# Check if this is first run
if [[ ! -f ".initialized" ]]; then
    echo -e "${YELLOW}👋 This appears to be your first time running the project.${NC}"
    echo "Let me guide you through the complete setup process."
    echo ""
    
    # Run health check first
    echo -e "${CYAN}🏥 Running health check...${NC}"
    if ./scripts/health-check.sh; then
        echo -e "${GREEN}✅ Health check passed!${NC}"
    else
        echo -e "${RED}❌ Health check failed. Please fix issues before continuing.${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${CYAN}⚙️ Running initial setup...${NC}"
    ./scripts/setup.sh
    
    echo ""
    echo -e "${CYAN}🔑 Managing program ID...${NC}"
    ./scripts/manage-program-id.sh generate
    
    echo ""
    echo -e "${CYAN}🔨 Building program (this creates the target/ folder)...${NC}"
./scripts/build-with-types.sh
    
    # Mark as initialized
    touch .initialized
    
    echo ""
    echo -e "${GREEN}🎉 Initial setup complete!${NC}"
else
    echo -e "${BLUE}📋 Project already initialized. Running quick checks...${NC}"
    
    # Quick health check
    if ./scripts/health-check.sh > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Project health: Good${NC}"
    else
        echo -e "${YELLOW}⚠️ Project health: Issues detected${NC}"
        echo "Run './scripts/health-check.sh' for details"
    fi
fi

# Show current status
echo ""
echo -e "${BLUE}📊 Current Status:${NC}"
echo "=================="

# Solana configuration
if solana config get &> /dev/null; then
    CLUSTER=$(solana config get | grep 'RPC URL' | awk '{print $3}')
    KEYPAIR=$(solana config get | grep 'Keypair Path' | awk '{print $3}')
    echo -e "Cluster: ${GREEN}$CLUSTER${NC}"
    echo -e "Keypair: ${GREEN}$KEYPAIR${NC}"
    
    if solana balance &> /dev/null; then
        BALANCE=$(solana balance)
        echo -e "Balance: ${GREEN}$BALANCE${NC}"
    fi
else
    echo -e "Solana: ${RED}Not configured${NC}"
fi

# Program ID
if [[ -f "target/deploy/escrow_system-keypair.json" ]]; then
    PROGRAM_ID=$(solana-keygen pubkey target/deploy/escrow_system-keypair.json)
    echo -e "Program ID: ${GREEN}$PROGRAM_ID${NC}"
else
    echo -e "Program ID: ${RED}Not generated${NC}"
fi

# Git status
if [[ -d ".git" ]]; then
    BRANCH=$(git branch --show-current)
    echo -e "Git branch: ${GREEN}$BRANCH${NC}"
    
    if git remote get-url origin &> /dev/null; then
        ORIGIN=$(git remote get-url origin)
        echo -e "Git remote: ${GREEN}$ORIGIN${NC}"
    else
        echo -e "Git remote: ${YELLOW}Not configured${NC}"
    fi
else
    echo -e "Git: ${RED}Not initialized${NC}"
fi

# Available commands
echo ""
echo -e "${BLUE}🛠️ Available Commands:${NC}"
echo "===================="
echo ""
echo -e "${CYAN}Development:${NC}"
echo "  make build          - Build the program"
echo "  make test           - Run all tests"
echo "  make deploy-local   - Deploy to localnet"
echo "  make example        - Run usage examples"
echo ""
echo -e "${CYAN}Deployment:${NC}"
echo "  make deploy-devnet  - Deploy to devnet"
echo "  make deploy-mainnet - Deploy to mainnet (careful!)"
echo ""
echo -e "${CYAN}Utilities:${NC}"
echo "  make health-check   - Check project health"
echo "  make lint           - Check code quality"
echo "  make format         - Format code"
echo "  make monitor        - Start monitoring"
echo ""
echo -e "${CYAN}GitHub:${NC}"
echo "  ./scripts/init-github.sh - Set up GitHub repository"
echo ""

# Quick action menu
echo -e "${BLUE}🎯 What would you like to do?${NC}"
echo "============================="
echo ""
echo "1) Run tests and verify everything works"
echo "2) Deploy to localnet and test"
echo "3) Deploy to devnet"
echo "4) Set up GitHub repository"
echo "5) Start monitoring dashboard"
echo "6) Run example usage"
echo "7) Show detailed help"
echo "8) Exit"
echo ""

read -p "Enter your choice (1-8): " -n 1 -r
echo ""

case $REPLY in
    1)
        echo -e "${CYAN}🧪 Running tests...${NC}"
        make test
        ;;
    2)
        echo -e "${CYAN}🚀 Deploying to localnet...${NC}"
        make deploy-local
        make example
        ;;
    3)
        echo -e "${CYAN}☁️ Deploying to devnet...${NC}"
        make deploy-devnet
        ;;
    4)
        echo -e "${CYAN}🐙 Setting up GitHub...${NC}"
        ./scripts/init-github.sh
        ;;
    5)
        echo -e "${CYAN}📊 Starting monitoring...${NC}"
        make monitor
        ;;
    6)
        echo -e "${CYAN}🎯 Running examples...${NC}"
        make example
        ;;
    7)
        echo -e "${CYAN}📚 Showing help...${NC}"
        make help
        ;;
    8)
        echo -e "${GREEN}👋 Goodbye!${NC}"
        exit 0
        ;;
    *)
        echo -e "${YELLOW}⚠️ Invalid choice. Run './scripts/quick-start.sh' again.${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Action completed!${NC}"
echo ""
echo -e "${BLUE}💡 Tips:${NC}"
echo "- Use 'make help' to see all available commands"
echo "- Check 'docs/' folder for detailed documentation"
echo "- Join our community on Discord for support"
echo "- Star the repository if you find it useful!"
echo ""
echo -e "${PURPLE}Happy coding! 🚀${NC}"
