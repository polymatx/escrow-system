// client/working-example.ts - Working example using exact test patterns
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { EscrowSystem } from "../target/types/escrow_system";
import { 
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";

async function runWorkingExample() {
  console.log("🚀 Starting Working Escrow Example...");
  console.log("=====================================");
  
  // Use the exact same setup as working tests
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.EscrowSystem as Program<EscrowSystem>;
  
  // Create test wallets
  const buyerKeypair = anchor.web3.Keypair.generate();
  const sellerKeypair = anchor.web3.Keypair.generate();
  
  console.log("👛 Test Wallets Created:");
  console.log("   Buyer:", buyerKeypair.publicKey.toString());
  console.log("   Seller:", sellerKeypair.publicKey.toString());
  
  // Airdrop SOL
  console.log("\n💰 Airdropping SOL...");
  await provider.connection.requestAirdrop(buyerKeypair.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
  await provider.connection.requestAirdrop(sellerKeypair.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Create mint and token accounts (exact same as tests)
  console.log("🪙 Setting up tokens...");
  const mint = await createMint(
    provider.connection,
    buyerKeypair,
    buyerKeypair.publicKey,
    null,
    6 // decimals
  );
  
  const buyerTokenAccount = await createAccount(
    provider.connection,
    buyerKeypair,
    mint,
    buyerKeypair.publicKey
  );
  
  const sellerTokenAccount = await createAccount(
    provider.connection,
    sellerKeypair,
    mint,
    sellerKeypair.publicKey
  );
  
  // Mint tokens to buyer
  await mintTo(
    provider.connection,
    buyerKeypair,
    mint,
    buyerTokenAccount,
    buyerKeypair,
    10000000 // 10 tokens
  );
  
  console.log("✅ Token setup complete");
  
  // Generate PDAs (exact same as tests)
  const escrowSeed = new anchor.BN(Date.now());
  const [escrowPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("escrow"),
      buyerKeypair.publicKey.toBuffer(),
      escrowSeed.toArrayLike(Buffer, "le", 8)
    ],
    program.programId
  );
  
  const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("vault"),
      buyerKeypair.publicKey.toBuffer(),
      escrowSeed.toArrayLike(Buffer, "le", 8)
    ],
    program.programId
  );
  
  console.log("🔑 Generated PDAs:");
  console.log("   Escrow:", escrowPda.toString());
  console.log("   Vault:", vaultPda.toString());
  
  const ESCROW_AMOUNT = new anchor.BN(1000000); // 1 token
  
  try {
    // Step 1: Initialize escrow (exact same method call as tests)
    console.log("\\n1️⃣ Initializing escrow...");
    const initTx = await program.methods
      .initializeEscrow(
        ESCROW_AMOUNT,
        escrowSeed,
        sellerKeypair.publicKey,
        "Example product delivery",
        new anchor.BN(24 * 3600) // 24 hour timeout
      )
      .accounts({
        escrow: escrowPda,
        vault: vaultPda,
        buyer: buyerKeypair.publicKey,
        mint: mint,
      })
      .signers([buyerKeypair])
      .rpc();
    
    console.log("✅ Escrow initialized!");
    console.log("   Transaction:", initTx);
    
    // Step 2: Deposit funds (exact same as tests)
    console.log("\\n2️⃣ Depositing funds...");
    const depositTx = await program.methods
      .deposit()
      .accounts({
        escrow: escrowPda,
        vault: vaultPda,
        depositor: buyerKeypair.publicKey,
        depositorTokenAccount: buyerTokenAccount,
      })
      .signers([buyerKeypair])
      .rpc();
    
    console.log("✅ Funds deposited!");
    console.log("   Transaction:", depositTx);
    
    // Step 3: Check escrow status (use exact same method as tests)
    console.log("\\n3️⃣ Checking escrow status...");
    const escrowAccount = await program.account.escrowAccount.fetch(escrowPda);
    console.log("✅ Escrow Details:");
    console.log("   Buyer:", escrowAccount.buyer.toString());
    console.log("   Seller:", escrowAccount.seller.toString());
    console.log("   Amount:", escrowAccount.amount.toString(), "tokens");
    console.log("   State:", Object.keys(escrowAccount.state)[0]);
    console.log("   Conditions:", escrowAccount.releaseConditions);
    
    // Check vault balance
    const vaultAccount = await getAccount(provider.connection, vaultPda);
    console.log("   Vault Balance:", vaultAccount.amount.toString(), "tokens");
    
    // Step 4: Release funds (exact same as tests)
    console.log("\\n4️⃣ Releasing funds to seller...");
    const releaseTx = await program.methods
      .release()
      .accounts({
        escrow: escrowPda,
        vault: vaultPda,
        authority: buyerKeypair.publicKey,
        sellerTokenAccount: sellerTokenAccount,
      })
      .signers([buyerKeypair])
      .rpc();
    
    console.log("✅ Funds released!");
    console.log("   Transaction:", releaseTx);
    
    // Step 5: Verify final state
    console.log("\\n5️⃣ Verifying final state...");
    const finalEscrowAccount = await program.account.escrowAccount.fetch(escrowPda);
    const finalSellerBalance = await getAccount(provider.connection, sellerTokenAccount);
    
    console.log("✅ Final Results:");
    console.log("   Escrow State:", Object.keys(finalEscrowAccount.state)[0]);
    console.log("   Seller Balance:", finalSellerBalance.amount.toString(), "tokens");
    console.log("   Released By:", finalEscrowAccount.releasedBy?.toString() || "N/A");
    
    console.log("\\n🎉 EXAMPLE COMPLETED SUCCESSFULLY!");
    console.log("====================================");
    console.log("Your escrow system is working perfectly!");
    
  } catch (error) {
    console.error("❌ Error in example:", error);
    if (error.logs) {
      console.error("Program logs:", error.logs);
    }
    throw error;
  }
}

// Self-executing function
(async () => {
  try {
    await runWorkingExample();
    console.log("\\n✅ Example finished successfully");
    process.exit(0);
  } catch (error) {
    console.error("\\n❌ Example failed:", error.message);
    process.exit(1);
  }
})();
