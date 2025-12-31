// client/working-example.js
const anchor = require("@coral-xyz/anchor");
const { 
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} = require("@solana/spl-token");
const idl = require("../target/idl/escrow_system.json");

// Define program ID explicitly
const PROGRAM_ID = "9pZmQesbcR58wxt3bncrm1S615sv2nr3LJYpcah1B6LB";

async function runWorkingExample() {
  console.log("Starting JavaScript Escrow Example...");
  console.log("=========================================");
  
  // Set up provider explicitly using anchor.web3
  const connection = new anchor.web3.Connection("http://127.0.0.1:8899", "confirmed");
  const wallet = new anchor.Wallet(anchor.web3.Keypair.fromSecretKey(
    Buffer.from(require(process.env.ANCHOR_WALLET || require("os").homedir() + "/.config/solana/id.json"))
  ));
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  
  // Initialize program using anchor.web3.PublicKey
  const programId = new anchor.web3.PublicKey(PROGRAM_ID);
  const program = new anchor.Program(idl, programId, provider);
  
  // Create test wallets using anchor.web3
  const buyerKeypair = anchor.web3.Keypair.generate();
  const sellerKeypair = anchor.web3.Keypair.generate();
  
  console.log("Test Wallets Created:");
  console.log("   Buyer:", buyerKeypair.publicKey.toString());
  console.log("   Seller:", sellerKeypair.publicKey.toString());
  
  // Airdrop SOL
  console.log("\nAirdropping SOL...");
  try {
    const airdropSig1 = await provider.connection.requestAirdrop(buyerKeypair.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(airdropSig1);
    const airdropSig2 = await provider.connection.requestAirdrop(sellerKeypair.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(airdropSig2);
  } catch (e) {
    console.log("   [WARN] Airdrop rate limited or failed, assuming wallets have funds or proceeding anyway...");
  }
  
  // Create mint and token accounts
  console.log("Setting up tokens...");
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
  
  console.log("[OK] Token setup complete");
  
  // Generate PDAs using anchor.web3
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
  
  console.log("Generated PDAs:");
  console.log("   Escrow:", escrowPda.toString());
  console.log("   Vault:", vaultPda.toString());
  
  const ESCROW_AMOUNT = new anchor.BN(1000000); // 1 token
  
  try {
    // Step 1: Initialize escrow
    console.log("\n[Step 1] Initializing escrow...");
    const initTx = await program.methods
      .initializeEscrow(
        ESCROW_AMOUNT,
        escrowSeed,
        sellerKeypair.publicKey,
        "JavaScript example - product delivery required",
        new anchor.BN(24 * 3600) // 24 hour timeout
      )
      .accounts({
        escrow: escrowPda,
        vault: vaultPda,
        buyer: buyerKeypair.publicKey,
        mint: mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([buyerKeypair])
      .rpc();
    
    console.log("[OK] Escrow initialized!");
    console.log("   Transaction:", initTx);
    
    // Step 2: Deposit funds
    console.log("\n[Step 2] Depositing funds...");
    const depositTx = await program.methods
      .deposit()
      .accounts({
        escrow: escrowPda,
        vault: vaultPda,
        depositor: buyerKeypair.publicKey,
        depositorTokenAccount: buyerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([buyerKeypair])
      .rpc();
    
    console.log("[OK] Funds deposited!");
    console.log("   Transaction:", depositTx);
    
    // Step 3: Check escrow status
    console.log("\n[Step 3] Checking escrow status...");
    const escrowAccount = await program.account.escrowAccount.fetch(escrowPda);
    console.log("[OK] Escrow Details:");
    console.log("   Buyer:", escrowAccount.buyer.toString());
    console.log("   Seller:", escrowAccount.seller.toString());
    console.log("   Amount:", escrowAccount.amount.toString(), "tokens");
    console.log("   State:", Object.keys(escrowAccount.state)[0]);
    console.log("   Conditions:", escrowAccount.releaseConditions);
    
    // Check vault balance
    const vaultAccount = await getAccount(provider.connection, vaultPda);
    console.log("   Vault Balance:", vaultAccount.amount.toString(), "tokens");
    
    // Step 4: Verify Cancel (Security Check) - Should fail if Funded
    console.log("\n[Step 4] Security Check: Attempting Rug Pull (Cancel Funded Escrow)...");
    try {
        await program.methods
        .cancel()
        .accounts({
            escrow: escrowPda,
            vault: vaultPda,
            authority: buyerKeypair.publicKey,
            buyerTokenAccount: buyerTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([buyerKeypair])
        .rpc();
        console.error("[FAIL] SECURITY FAILURE: Rug pull was successful!");
    } catch (e) {
        console.log("[OK] Security Pass: Rug pull prevented (Transaction failed as expected).");
    }

    // Step 5: Release funds
    console.log("\n[Step 5] Releasing funds to seller...");
    const releaseTx = await program.methods
      .release()
      .accounts({
        escrow: escrowPda,
        vault: vaultPda,
        authority: buyerKeypair.publicKey,
        sellerTokenAccount: sellerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([buyerKeypair])
      .rpc();
    
    console.log("[OK] Funds released!");
    console.log("   Transaction:", releaseTx);
    
    // Step 6: Verify final state
    console.log("\n[Step 6] Verifying final state...");
    const finalEscrowAccount = await program.account.escrowAccount.fetch(escrowPda);
    const finalSellerBalance = await getAccount(provider.connection, sellerTokenAccount);
    
    console.log("[OK] Final Results:");
    console.log("   Escrow State:", Object.keys(finalEscrowAccount.state)[0]);
    console.log("   Seller Balance:", finalSellerBalance.amount.toString(), "tokens");
    console.log("   Released By:", finalEscrowAccount.releasedBy?.toString() || "N/A");
    
    console.log("\nJAVASCRIPT EXAMPLE COMPLETED SUCCESSFULLY!");
    console.log("==============================================");
    
  } catch (error) {
    console.error("[ERROR] Error in example:", error);
    process.exit(1);
  }
}

runWorkingExample();
