#!/bin/bash
set -e

# Utility script to check and manage system requirements

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 System Requirements Checker${NC}"
echo "==============================="

# Check operating system
echo -e "\n${BLUE}💻 Operating System:${NC}"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo -e "${GREEN}✅ Linux detected${NC}"
    DISTRO=$(lsb_release -si 2>/dev/null || echo "Unknown")
    VERSION=$(lsb_release -sr 2>/dev/null || echo "Unknown")
    echo "Distribution: $DISTRO $VERSION"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${GREEN}✅ macOS detected${NC}"
    VERSION=$(sw_vers -productVersion)
    echo "Version: $VERSION"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    echo -e "${YELLOW}⚠️ Windows detected${NC}"
    echo "Note: Some scripts may need WSL (Windows Subsystem for Linux)"
else
    echo -e "${YELLOW}⚠️ Unknown OS: $OSTYPE${NC}"
fi

# Check Rust installation
echo -e "\n${BLUE}🦀 Rust Environment:${NC}"
if command -v rustc &> /dev/null; then
    RUST_VERSION=$(rustc --version)
    echo -e "${GREEN}✅ $RUST_VERSION${NC}"
    
    # Check Rust toolchain
    if command -v rustup &> /dev/null; then
        TOOLCHAIN=$(rustup show active-toolchain)
        echo "Active toolchain: $TOOLCHAIN"
    fi
    
    # Check Cargo
    if command -v cargo &> /dev/null; then
        CARGO_VERSION=$(cargo --version)
        echo "Cargo: $CARGO_VERSION"
    fi
else
    echo -e "${RED}❌ Rust not installed${NC}"
    echo "Install with: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
fi

# Check Solana installation
echo -e "\n${BLUE}⚡ Solana Environment:${NC}"
if command -v solana &> /dev/null; then
    SOLANA_VERSION=$(solana --version)
    echo -e "${GREEN}✅ $SOLANA_VERSION${NC}"
    
    # Check Solana configuration
    if solana config get &> /dev/null; then
        echo "Configuration:"
        solana config get | while read line; do
            echo "  $line"
        done
    fi
else
    echo -e "${RED}❌ Solana CLI not installed${NC}"
    echo "Install with: curl -sSfL https://release.solana.com/v1.18.18/install | sh"
fi

# Check Anchor installation  
echo -e "\n${BLUE}⚓ Anchor Framework:${NC}"
if command -v anchor &> /dev/null; then
    ANCHOR_VERSION=$(anchor --version)
    echo -e "${GREEN}✅ $ANCHOR_VERSION${NC}"
    
    # Check AVM (Anchor Version Manager)
    if command -v avm &> /dev/null; then
        AVM_VERSION=$(avm --version 2>/dev/null || echo "Unknown")
        echo "AVM: $AVM_VERSION"
    fi
else
    echo -e "${RED}❌ Anchor not installed${NC}"
    echo "Install with: cargo install --git https://github.com/coral-xyz/anchor avm --locked --force"
fi

# Check Node.js environment
echo -e "\n${BLUE}📦 Node.js Environment:${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js $NODE_VERSION${NC}"
    
    # Check package manager
    if command -v yarn &> /dev/null; then
        YARN_VERSION=$(yarn --version)
        echo "Yarn: $YARN_VERSION"
        PACKAGE_MANAGER="yarn"
    elif command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        echo "NPM: $NPM_VERSION"
        PACKAGE_MANAGER="npm"
    else
        echo -e "${RED}❌ No package manager found${NC}"
    fi
else
    echo -e "${RED}❌ Node.js not installed${NC}"
    echo "Install from: https://nodejs.org/"
fi

# Check Git
echo -e "\n${BLUE}📝 Git:${NC}"
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    echo -e "${GREEN}✅ $GIT_VERSION${NC}"
    
    # Check Git configuration
    if git config user.name &> /dev/null && git config user.email &> /dev/null; then
        echo "User: $(git config user.name) <$(git config user.email)>"
    else
        echo -e "${YELLOW}⚠️ Git user not configured${NC}"
        echo "Set with: git config --global user.name 'Your Name'"
        echo "         git config --global user.email 'your.email@example.com'"
    fi
else
    echo -e "${RED}❌ Git not installed${NC}"
fi

# Check additional tools
echo -e "\n${BLUE}🔧 Additional Tools:${NC}"

# Check jq (JSON processor)
if command -v jq &> /dev/null; then
    echo -e "${GREEN}✅ jq installed${NC}"
else
    echo -e "${YELLOW}⚠️ jq not installed (used by some scripts)${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "Install with: brew install jq"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "Install with: sudo apt-get install jq"
    fi
fi

# Check bc (calculator)
if command -v bc &> /dev/null; then
    echo -e "${GREEN}✅ bc installed${NC}"
else
    echo -e "${YELLOW}⚠️ bc not installed (used by deployment scripts)${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "Install with: brew install bc"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "Install with: sudo apt-get install bc"
    fi
fi

# Disk space check
echo -e "\n${BLUE}💾 Disk Space:${NC}"
AVAILABLE_SPACE=$(df -h . | awk 'NR==2 {print $4}')
echo "Available space: $AVAILABLE_SPACE"

# Memory check (if available)
echo -e "\n${BLUE}🧠 Memory:${NC}"
if command -v free &> /dev/null; then
    MEMORY=$(free -h | awk 'NR==2{printf "Total: %s, Available: %s", $2,$7}')
    echo "$MEMORY"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    MEMORY=$(system_profiler SPHardwareDataType | awk '/Memory/ {print $2 " " $3}')
    echo "Total: $MEMORY"
fi

# Network connectivity check
echo -e "\n${BLUE}🌐 Network Connectivity:${NC}"
if ping -c 1 google.com &> /dev/null; then
    echo -e "${GREEN}✅ Internet connection available${NC}"
    
    # Check Solana network connectivity
    if solana cluster-version &> /dev/null 2>&1; then
        echo -e "${GREEN}✅ Solana network reachable${NC}"
    else
        echo -e "${YELLOW}⚠️ Solana network not reachable (may be on localhost)${NC}"
    fi
else
    echo -e "${RED}❌ No internet connection${NC}"
fi

# Final summary
echo -e "\n${BLUE}📊 Summary:${NC}"
echo "==========="

MISSING_TOOLS=()

# Check essential tools
[[ ! $(command -v rustc) ]] && MISSING_TOOLS+=("Rust")
[[ ! $(command -v solana) ]] && MISSING_TOOLS+=("Solana CLI")
[[ ! $(command -v anchor) ]] && MISSING_TOOLS+=("Anchor")
[[ ! $(command -v node) ]] && MISSING_TOOLS+=("Node.js")
[[ ! $(command -v git) ]] && MISSING_TOOLS+=("Git")

if [[ ${#MISSING_TOOLS[@]} -eq 0 ]]; then
    echo -e "${GREEN}🎉 All essential tools are installed!${NC}"
    echo "You're ready to start developing."
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Run './scripts/quick-start.sh' to begin"
    echo "2. Or run 'make dev' for development workflow"
    echo "3. Check 'GETTING_STARTED.md' for detailed guide"
else
    echo -e "${RED}❌ Missing essential tools:${NC}"
    printf '%s\n' "${MISSING_TOOLS[@]}"
    echo ""
    echo -e "${BLUE}Please install the missing tools and run this check again.${NC}"
fi
