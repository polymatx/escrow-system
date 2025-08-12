// client/simple-example.ts - Working example that uses the same pattern as tests
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

async function runEscrowExample() {
  console.log("🚀 Starting Escrow System Example...");
  
  // Initialize provider and program (same as tests)
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.EscrowSystem as Program<EscrowSystem>;
  
  // Create test wallets
  const buyerKeypair = anchor.web3.Keypair.generate();
  const sellerKeypair = anchor.web3.Keypair.generate();
  
  console.log("👛 Created test wallets:");
  console.log("Buyer:", buyerKeypair.publicKey.toString());
  console.log("Seller:", sellerKeypair.publicKey.toString());
  
  // Airdrop SOL
  console.log("💰 Airdropping SOL...");
  await provider.connection.requestAirdrop(buyerKeypair.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
  await provider.connection.requestAirdrop(sellerKeypair.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Create mint and token accounts
  console.log("🪙 Creating token mint and accounts...");
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
  
  // Generate escrow PDAs
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
  console.log("Escrow:", escrowPda.toString());
  console.log("Vault:", vaultPda.toString());
  
  const ESCROW_AMOUNT = new anchor.BN(1000000); // 1 token
  
  try {
    // 1. Initialize escrow
    console.log("\n1️⃣ Initializing escrow...");
    const initTx = await program.methods
      .initializeEscrow(
        ESCROW_AMOUNT,
        escrowSeed,
        sellerKeypair.publicKey,
        "Example escrow for testing",
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
    
    console.log("✅ Escrow initialized! TX:", initTx);
    
    // 2. Deposit funds
    console.log("\n2️⃣ Depositing funds...");
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
    
    console.log("✅ Funds deposited! TX:", depositTx);
    
    // 3. Check escrow status (this is where the issue might be)
    console.log("\n3️⃣ Checking escrow status...");
    
    // Try to fetch the account using the same pattern as tests
    const escrowAccountData = await program.account.escrowAccount.fetch(escrowPda);
    console.log("✅ Escrow status:", {
      buyer: escrowAccountData.buyer.toString(),
      seller: escrowAccountData.seller.toString(),
      amount: escrowAccountData.amount.toString(),
      state: escrowAccountData.state,
    });
    
    // 4. Release funds
    console.log("\n4️⃣ Releasing funds to seller...");
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
    
    console.log("✅ Funds released! TX:", releaseTx);
    
    // 5. Verify final balances
    console.log("\n5️⃣ Checking final balances...");
    const sellerBalance = await getAccount(provider.connection, sellerTokenAccount);
    console.log("Seller token balance:", sellerBalance.amount.toString());
    
    console.log("\n🎉 Example completed successfully!");
    
  } catch (error) {
    console.error("❌ Error in example:", error);
    throw error;
  }
}

// Run the example
if (require.main === module) {
  runEscrowExample()
    .then(() => {
      console.log("✅ Example finished");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Example failed:", error);
      process.exit(1);
    });
}

export { runEscrowExample };
