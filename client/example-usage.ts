// client/example-usage.ts
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { createMint, createAccount, mintTo } from "@solana/spl-token";
import { EscrowClient, createEscrowClient } from "./escrow-client";
import { BN } from "@coral-xyz/anchor";

// Example usage of the Escrow Client
async function main() {
    // Setup connection and wallet
    const connection = new Connection("http://localhost:8899", "confirmed");
    
    // Load keypairs (in production, use proper wallet management)
    const buyer = Keypair.generate();
    const seller = Keypair.generate();
    const arbiter = Keypair.generate();
    
    // Airdrop SOL for testing
    await connection.requestAirdrop(buyer.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await connection.requestAirdrop(seller.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
    await connection.requestAirdrop(arbiter.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
    
    // Wait for airdrops
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Create mock wallet interface
    const wallet = {
        publicKey: buyer.publicKey,
        signTransaction: async (tx: any) => {
            tx.sign([buyer]);
            return tx;
        },
        signAllTransactions: async (txs: any[]) => {
            txs.forEach(tx => tx.sign([buyer]));
            return txs;
        },
    };
    
    // Program ID (deployed on Devnet)
    const programId = new PublicKey("9pZmQesbcR58wxt3bncrm1S615sv2nr3LJYpcah1B6LB");
    
    try {
        // Initialize escrow client
        console.log("Initializing Escrow Client...");
        const escrowClient = await createEscrowClient(connection, wallet, programId);
        
        // Create test token mint
        console.log("Creating test token...");
        const mint = await createMint(
            connection,
            buyer,
            buyer.publicKey,
            null,
            6 // USDC has 6 decimals
        );
        
        // Create token accounts for buyer and seller
        const buyerTokenAccount = await createAccount(
            connection,
            buyer,
            mint,
            buyer.publicKey
        );
        
        const sellerTokenAccount = await createAccount(
            connection,
            seller,
            mint,
            seller.publicKey
        );
        
        // Mint some tokens to buyer
        await mintTo(
            connection,
            buyer,
            mint,
            buyerTokenAccount,
            buyer,
            1000 * 1000000 // 1000 tokens with 6 decimals
        );
        
        console.log("[OK] Minted 1000 tokens to buyer");
        
        // Example 1: Basic Escrow Flow
        console.log("\n=== Example 1: Basic Escrow Flow ===");
        
        const escrowConfig = {
            amount: new BN(100 * 1000000), // 100 tokens
            seller: seller.publicKey,
            mint: mint,
            releaseConditions: "Product must be delivered within 7 days",
        };
        
        // Initialize escrow
        console.log("Creating escrow...");
        const { signature: initSig, escrow, vault } = await escrowClient.initializeEscrow(
            buyer,
            escrowConfig
        );
        console.log(`[OK] Escrow created: ${escrow.toString()}`);
        console.log(`Vault: ${vault.toString()}`);
        console.log(`Transaction: ${initSig}`);
        
        // Get escrow info
        const escrowInfo = await escrowClient.getEscrowInfo(escrow);
        console.log(`Escrow State: ${escrowInfo.state}`);
        console.log(`Amount: ${escrowInfo.amount.toString()}`);
        
        // Deposit funds
        console.log("Depositing funds...");
        const depositSig = await escrowClient.deposit(buyer, escrow, mint);
        console.log(`[OK] Funds deposited: ${depositSig}`);
        
        // Check updated state
        const fundedInfo = await escrowClient.getEscrowInfo(escrow);
        console.log(`Updated State: ${fundedInfo.state}`);
        
        // Set arbiter
        console.log("Setting arbiter...");
        const arbiterSig = await escrowClient.setArbiter(buyer, escrow, arbiter.publicKey);
        console.log(`[OK] Arbiter set: ${arbiterSig}`);
        
        // Release funds (buyer releases)
        console.log("Releasing funds...");
        const releaseSig = await escrowClient.releaseFunds(buyer, escrow);
        console.log(`[OK] Funds released: ${releaseSig}`);
        
        // Check final state
        const releasedInfo = await escrowClient.getEscrowInfo(escrow);
        console.log(`Final State: ${releasedInfo.state}`);
        
        // Example 2: Escrow with Timeout
        console.log("\n=== Example 2: Escrow with Timeout ===");
        
        const timeoutConfig = {
            amount: new BN(50 * 1000000), // 50 tokens
            seller: seller.publicKey,
            mint: mint,
            releaseConditions: "Auto-release after 60 seconds",
            timeoutDuration: new BN(60), // 60 seconds timeout
        };
        
        const { escrow: timeoutEscrow } = await escrowClient.initializeEscrow(
            buyer,
            timeoutConfig
        );
        
        await escrowClient.deposit(buyer, timeoutEscrow, mint);
        
        const timeoutInfo = await escrowClient.getEscrowInfo(timeoutEscrow);
        console.log(`Timeout at: ${new Date(timeoutInfo.timeoutAt!.toNumber() * 1000)}`);
        console.log(`Time until timeout: ${escrowClient.getTimeUntilTimeout(timeoutInfo)} seconds`);
        
        // Example 3: List User's Escrows
        console.log("\n=== Example 3: List User's Escrows ===");
        
        const buyerEscrows = await escrowClient.getEscrowsForBuyer(buyer.publicKey);
        console.log(`Buyer has ${buyerEscrows.length} escrows`);
        
        const sellerEscrows = await escrowClient.getEscrowsForSeller(seller.publicKey);
        console.log(`Seller has ${sellerEscrows.length} escrows`);
        
        // Example 4: Event Listening
        console.log("\n=== Example 4: Event Listening ===");
        
        const listenerId = escrowClient.addEventListener("EscrowCreated", (event, slot, signature) => {
            console.log(`New escrow created: ${event.escrow.toString()}`);
            console.log(`Amount: ${event.amount.toString()}`);
            console.log(`Signature: ${signature}`);
        });
        
        // Create another escrow to trigger the event
        const eventTestConfig = {
            amount: new BN(25 * 1000000),
            seller: seller.publicKey,
            mint: mint,
            releaseConditions: "Event test escrow",
        };
        
        await escrowClient.initializeEscrow(buyer, eventTestConfig);
        
        // Wait a bit for the event
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Remove event listener
        await escrowClient.removeEventListener(listenerId);
        console.log("Event listener removed");
        
        console.log("\n[OK] All examples completed successfully!");
        
    } catch (error) {
        console.error("[ERROR]", error);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

export { main as runExamples };
