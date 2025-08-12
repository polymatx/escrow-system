#!/bin/bash
set -e

# Program ID management utility

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

COMMAND=$1

show_usage() {
    echo "Program ID Management Utility"
    echo ""
    echo "Usage: ./manage-program-id.sh [command]"
    echo ""
    echo "Commands:"
    echo "  generate    Generate new program keypair and update files"
    echo "  show        Show current program ID"
    echo "  update      Update program ID in source files"
    echo "  verify      Verify program ID consistency"
    echo "  backup      Backup current program keypair"
    echo "  restore     Restore program keypair from backup"
    echo ""
}

generate_program_id() {
    echo -e "${BLUE}🔑 Generating new program keypair...${NC}"
    
    # Backup existing keypair if it exists
    KEYPAIR_PATH="target/deploy/escrow_system-keypair.json"
    if [[ -f "$KEYPAIR_PATH" ]]; then
        BACKUP_PATH="keypairs/escrow_system-keypair-backup-$(date +%Y%m%d-%H%M%S).json"
        mkdir -p keypairs
        cp "$KEYPAIR_PATH" "$BACKUP_PATH"
        echo -e "${YELLOW}📁 Backed up existing keypair to: $BACKUP_PATH${NC}"
    fi
    
    # Create target directory if it doesn't exist
    mkdir -p target/deploy
    
    # Generate new keypair
    solana-keygen new --no-bip39-passphrase --silent --outfile "$KEYPAIR_PATH"
    PROGRAM_ID=$(solana-keygen pubkey "$KEYPAIR_PATH")
    
    echo -e "${GREEN}✅ Generated new program ID: $PROGRAM_ID${NC}"
    
    # Update source files
    update_source_files "$PROGRAM_ID"
    
    echo -e "${GREEN}🎉 Program ID generation complete!${NC}"
}

show_program_id() {
    KEYPAIR_PATH="target/deploy/escrow_system-keypair.json"
    
    if [[ -f "$KEYPAIR_PATH" ]]; then
        PROGRAM_ID=$(solana-keygen pubkey "$KEYPAIR_PATH")
        echo -e "${BLUE}📋 Current Program ID: $PROGRAM_ID${NC}"
        
        # Show where it's used
        echo ""
        echo -e "${BLUE}📍 Usage in files:${NC}"
        grep -n "declare_id!" programs/escrow-system/src/lib.rs || echo "Not found in lib.rs"
        grep -n "escrow_system.*=" Anchor.toml || echo "Not found in Anchor.toml"
    else
        echo -e "${RED}❌ Program keypair not found: $KEYPAIR_PATH${NC}"
        echo "Run './manage-program-id.sh generate' to create one"
    fi
}

update_source_files() {
    local PROGRAM_ID=$1
    
    echo -e "${YELLOW}📝 Updating source files with Program ID: $PROGRAM_ID${NC}"
    
    # Update lib.rs
    if [[ -f "programs/escrow-system/src/lib.rs" ]]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/declare_id!(\".*\")/declare_id!(\"$PROGRAM_ID\")/g" programs/escrow-system/src/lib.rs
        else
            # Linux
            sed -i "s/declare_id!(\".*\")/declare_id!(\"$PROGRAM_ID\")/g" programs/escrow-system/src/lib.rs
        fi
        echo -e "${GREEN}✅ Updated lib.rs${NC}"
    else
        echo -e "${RED}❌ lib.rs not found${NC}"
    fi
    
    # Update Anchor.toml
    if [[ -f "Anchor.toml" ]]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/escrow_system = \".*\"/escrow_system = \"$PROGRAM_ID\"/g" Anchor.toml
        else
            # Linux
            sed -i "s/escrow_system = \".*\"/escrow_system = \"$PROGRAM_ID\"/g" Anchor.toml
        fi
        echo -e "${GREEN}✅ Updated Anchor.toml${NC}"
    else
        echo -e "${RED}❌ Anchor.toml not found${NC}"
    fi
}

verify_consistency() {
    echo -e "${BLUE}🔍 Verifying program ID consistency...${NC}"
    
    KEYPAIR_PATH="target/deploy/escrow_system-keypair.json"
    
    if [[ ! -f "$KEYPAIR_PATH" ]]; then
        echo -e "${RED}❌ Program keypair not found${NC}"
        return 1
    fi
    
    EXPECTED_ID=$(solana-keygen pubkey "$KEYPAIR_PATH")
    
    # Check lib.rs
    if [[ -f "programs/escrow-system/src/lib.rs" ]]; then
        DECLARED_ID=$(grep -o 'declare_id!(".*")' programs/escrow-system/src/lib.rs | grep -o '".*"' | tr -d '"')
        
        if [[ "$EXPECTED_ID" == "$DECLARED_ID" ]]; then
            echo -e "${GREEN}✅ lib.rs: $DECLARED_ID${NC}"
        else
            echo -e "${RED}❌ lib.rs mismatch: Expected $EXPECTED_ID, Found $DECLARED_ID${NC}"
            return 1
        fi
    fi
    
    # Check Anchor.toml
    if [[ -f "Anchor.toml" ]]; then
        ANCHOR_IDS=$(grep "escrow_system.*=" Anchor.toml | grep -o '".*"' | tr -d '"')
        
        for ANCHOR_ID in $ANCHOR_IDS; do
            if [[ "$EXPECTED_ID" == "$ANCHOR_ID" ]]; then
                echo -e "${GREEN}✅ Anchor.toml: $ANCHOR_ID${NC}"
            else
                echo -e "${RED}❌ Anchor.toml mismatch: Expected $EXPECTED_ID, Found $ANCHOR_ID${NC}"
                return 1
            fi
        done
    fi
    
    echo -e "${GREEN}🎉 All program IDs are consistent!${NC}"
}

backup_keypair() {
    KEYPAIR_PATH="target/deploy/escrow_system-keypair.json"
    
    if [[ ! -f "$KEYPAIR_PATH" ]]; then
        echo -e "${RED}❌ No keypair to backup${NC}"
        return 1
    fi
    
    mkdir -p keypairs
    BACKUP_PATH="keypairs/escrow_system-keypair-backup-$(date +%Y%m%d-%H%M%S).json"
    cp "$KEYPAIR_PATH" "$BACKUP_PATH"
    
    echo -e "${GREEN}✅ Keypair backed up to: $BACKUP_PATH${NC}"
    echo -e "${YELLOW}⚠️ Store this backup securely!${NC}"
}

restore_keypair() {
    echo -e "${BLUE}📁 Available backups:${NC}"
    
    if [[ ! -d "keypairs" ]] || [[ -z "$(ls -A keypairs/)" ]]; then
        echo -e "${RED}❌ No backups found${NC}"
        return 1
    fi
    
    ls -la keypairs/escrow_system-keypair-backup-*.json 2>/dev/null || {
        echo -e "${RED}❌ No program keypair backups found${NC}"
        return 1
    }
    
    echo ""
    read -p "Enter the backup filename to restore: " BACKUP_FILE
    
    if [[ -f "keypairs/$BACKUP_FILE" ]]; then
        mkdir -p target/deploy
        cp "keypairs/$BACKUP_FILE" "target/deploy/escrow_system-keypair.json"
        
        PROGRAM_ID=$(solana-keygen pubkey "target/deploy/escrow_system-keypair.json")
        echo -e "${GREEN}✅ Restored keypair: $PROGRAM_ID${NC}"
        
        # Update source files
        update_source_files "$PROGRAM_ID"
    else
        echo -e "${RED}❌ Backup file not found: keypairs/$BACKUP_FILE${NC}"
        return 1
    fi
}

# Main command processing
case $COMMAND in
    generate)
        generate_program_id
        ;;
    show)
        show_program_id
        ;;
    update)
        if [[ -f "target/deploy/escrow_system-keypair.json" ]]; then
            PROGRAM_ID=$(solana-keygen pubkey "target/deploy/escrow_system-keypair.json")
            update_source_files "$PROGRAM_ID"
        else
            echo -e "${RED}❌ Program keypair not found${NC}"
            exit 1
        fi
        ;;
    verify)
        verify_consistency
        ;;
    backup)
        backup_keypair
        ;;
    restore)
        restore_keypair
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
