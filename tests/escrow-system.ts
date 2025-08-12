// tests/escrow-system.ts
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
import { assert } from "chai";

describe("Escrow System", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Use properly typed program
  const program = anchor.workspace.EscrowSystem as Program<EscrowSystem>;
  
  // Test wallets
  let buyerKeypair: anchor.web3.Keypair;
  let sellerKeypair: anchor.web3.Keypair;
  let arbiterKeypair: anchor.web3.Keypair;
  
  // Token accounts
  let mint: anchor.web3.PublicKey;
  let buyerTokenAccount: anchor.web3.PublicKey;
  let sellerTokenAccount: anchor.web3.PublicKey;
  
  // Escrow accounts
  let escrowPda: anchor.web3.PublicKey;
  let vaultPda: anchor.web3.PublicKey;
  let escrowSeed: anchor.BN;
  
  const ESCROW_AMOUNT = new anchor.BN(1000000); // 1 token (6 decimals)

  before(async () => {
    // Initialize test wallets
    buyerKeypair = anchor.web3.Keypair.generate();
    sellerKeypair = anchor.web3.Keypair.generate();
    arbiterKeypair = anchor.web3.Keypair.generate();

    // Airdrop SOL to wallets
    await provider.connection.requestAirdrop(buyerKeypair.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(sellerKeypair.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(arbiterKeypair.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    
    // Wait for airdrops
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create mint
    mint = await createMint(
      provider.connection,
      buyerKeypair,
      buyerKeypair.publicKey,
      null,
      6 // decimals
    );

    // Create token accounts for buyer and seller
    buyerTokenAccount = await createAccount(
      provider.connection,
      buyerKeypair,
      mint,
      buyerKeypair.publicKey
    );

    sellerTokenAccount = await createAccount(
      provider.connection,
      sellerKeypair,
      mint,
      sellerKeypair.publicKey
    );

    // Mint some tokens to buyer
    await mintTo(
      provider.connection,
      buyerKeypair,
      mint,
      buyerTokenAccount,
      buyerKeypair,
      10000000 // 10 tokens
    );

    // Generate escrow seed and PDAs
    escrowSeed = new anchor.BN(Date.now());
    
    [escrowPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        buyerKeypair.publicKey.toBuffer(),
        escrowSeed.toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault"),
        buyerKeypair.publicKey.toBuffer(),
        escrowSeed.toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );
  });

  describe("Initialize Escrow", () => {
    it("Should initialize escrow successfully", async () => {
      const tx = await program.methods
        .initializeEscrow(
          ESCROW_AMOUNT,
          escrowSeed,
          sellerKeypair.publicKey,
          "Product delivery required",
          null // no timeout
        )
        .accounts({
          escrow: escrowPda,
          vault: vaultPda,
          buyer: buyerKeypair.publicKey,
          mint: mint,
        })
        .signers([buyerKeypair])
        .rpc();

      console.log("Initialize escrow tx:", tx);

      // Verify escrow account
      const escrowAccount = await program.account.escrowAccount.fetch(escrowPda);
      assert.equal(escrowAccount.buyer.toString(), buyerKeypair.publicKey.toString());
      assert.equal(escrowAccount.seller.toString(), sellerKeypair.publicKey.toString());
      assert.equal(escrowAccount.amount.toString(), ESCROW_AMOUNT.toString());
      assert.equal(escrowAccount.state.initialized !== undefined, true);
    });

    it("Should fail with invalid amount", async () => {
      const invalidEscrowSeed = new anchor.BN(Date.now() + 1);
      
      const [invalidEscrowPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          buyerKeypair.publicKey.toBuffer(),
          invalidEscrowSeed.toArrayLike(Buffer, "le", 8)
        ],
        program.programId
      );

      const [invalidVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("vault"),
          buyerKeypair.publicKey.toBuffer(),
          invalidEscrowSeed.toArrayLike(Buffer, "le", 8)
        ],
        program.programId
      );

      try {
        await program.methods
          .initializeEscrow(
            new anchor.BN(0), // invalid amount
            invalidEscrowSeed,
            sellerKeypair.publicKey,
            "Test conditions",
            null
          )
          .accounts({
            escrow: invalidEscrowPda,
            vault: invalidVaultPda,
            buyer: buyerKeypair.publicKey,
            mint: mint,
          })
          .signers([buyerKeypair])
          .rpc();
        
        assert.fail("Expected transaction to fail");
      } catch (error) {
        assert.include(error.message, "InvalidAmount");
      }
    });
  });

  describe("Deposit Funds", () => {
    it("Should deposit funds successfully", async () => {
      const tx = await program.methods
        .deposit()
        .accounts({
          escrow: escrowPda,
          vault: vaultPda,
          depositor: buyerKeypair.publicKey,
          depositorTokenAccount: buyerTokenAccount,
        })
        .signers([buyerKeypair])
        .rpc();

      console.log("Deposit tx:", tx);

      // Verify escrow state
      const escrowAccount = await program.account.escrowAccount.fetch(escrowPda);
      assert.equal(escrowAccount.state.funded !== undefined, true);
      assert.isNotNull(escrowAccount.fundedAt);

      // Verify vault has tokens
      const vaultAccount = await getAccount(provider.connection, vaultPda);
      assert.equal(vaultAccount.amount.toString(), ESCROW_AMOUNT.toString());

      // Verify buyer's token balance decreased
      const buyerAccount = await getAccount(provider.connection, buyerTokenAccount);
      assert.equal(buyerAccount.amount.toString(), "9000000"); // 10 - 1 = 9 tokens
    });

    it("Should fail if not buyer trying to deposit", async () => {
      // Create another escrow for this test
      const newEscrowSeed = new anchor.BN(Date.now() + 100);
      
      const [newEscrowPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          buyerKeypair.publicKey.toBuffer(),
          newEscrowSeed.toArrayLike(Buffer, "le", 8)
        ],
        program.programId
      );

      const [newVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("vault"),
          buyerKeypair.publicKey.toBuffer(),
          newEscrowSeed.toArrayLike(Buffer, "le", 8)
        ],
        program.programId
      );

      // Initialize new escrow
      await program.methods
        .initializeEscrow(
          ESCROW_AMOUNT,
          newEscrowSeed,
          sellerKeypair.publicKey,
          "Test escrow",
          null
        )
        .accounts({
          escrow: newEscrowPda,
          vault: newVaultPda,
          buyer: buyerKeypair.publicKey,
          mint: mint,
        })
        .signers([buyerKeypair])
        .rpc();

      // Try to deposit as seller (should fail)
      try {
        await program.methods
          .deposit()
          .accounts({
            escrow: newEscrowPda,
            vault: newVaultPda,
            depositor: sellerKeypair.publicKey,
            depositorTokenAccount: sellerTokenAccount,
          })
          .signers([sellerKeypair])
          .rpc();
        
        assert.fail("Expected transaction to fail");
      } catch (error) {
        assert.include(error.message, "UnauthorizedDepositor");
      }
    });
  });

  describe("Set Arbiter", () => {
    it("Should set arbiter successfully", async () => {
      const tx = await program.methods
        .setArbiter(arbiterKeypair.publicKey)
        .accounts({
          escrow: escrowPda,
          authority: buyerKeypair.publicKey,
        })
        .signers([buyerKeypair])
        .rpc();

      console.log("Set arbiter tx:", tx);

      // Verify arbiter is set
      const escrowAccount = await program.account.escrowAccount.fetch(escrowPda);
      assert.equal(escrowAccount.arbiter.toString(), arbiterKeypair.publicKey.toString());
    });
  });

  describe("Release Funds", () => {
    it("Should release funds by buyer", async () => {
      const sellerBalanceBefore = await getAccount(provider.connection, sellerTokenAccount);
      
      const tx = await program.methods
        .release()
        .accounts({
          escrow: escrowPda,
          vault: vaultPda,
          authority: buyerKeypair.publicKey,
          sellerTokenAccount: sellerTokenAccount,
        })
        .signers([buyerKeypair])
        .rpc();

      console.log("Release tx:", tx);

      // Verify escrow state
      const escrowAccount = await program.account.escrowAccount.fetch(escrowPda);
      assert.equal(escrowAccount.state.released !== undefined, true);
      assert.isNotNull(escrowAccount.releasedAt);
      assert.equal(escrowAccount.releasedBy.toString(), buyerKeypair.publicKey.toString());

      // Verify seller received tokens
      const sellerBalanceAfter = await getAccount(provider.connection, sellerTokenAccount);
      const expectedBalance = sellerBalanceBefore.amount + BigInt(ESCROW_AMOUNT.toString());
      assert.equal(sellerBalanceAfter.amount.toString(), expectedBalance.toString());

      // Verify vault is empty
      const vaultAccount = await getAccount(provider.connection, vaultPda);
      assert.equal(vaultAccount.amount.toString(), "0");
    });

    it("Should release funds by arbiter", async () => {
      // Create new escrow for this test
      const newEscrowSeed = new anchor.BN(Date.now() + 200);
      const [newEscrowPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          buyerKeypair.publicKey.toBuffer(),
          newEscrowSeed.toArrayLike(Buffer, "le", 8)
        ],
        program.programId
      );
      const [newVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("vault"),
          buyerKeypair.publicKey.toBuffer(),
          newEscrowSeed.toArrayLike(Buffer, "le", 8)
        ],
        program.programId
      );

      // Initialize, deposit, and set arbiter
      await program.methods
        .initializeEscrow(
          ESCROW_AMOUNT,
          newEscrowSeed,
          sellerKeypair.publicKey,
          "Arbiter test",
          null
        )
        .accounts({
          escrow: newEscrowPda,
          vault: newVaultPda,
          buyer: buyerKeypair.publicKey,
          mint: mint,
        })
        .signers([buyerKeypair])
        .rpc();

      await program.methods
        .deposit()
        .accounts({
          escrow: newEscrowPda,
          vault: newVaultPda,
          depositor: buyerKeypair.publicKey,
          depositorTokenAccount: buyerTokenAccount,
        })
        .signers([buyerKeypair])
        .rpc();

      await program.methods
        .setArbiter(arbiterKeypair.publicKey)
        .accounts({
          escrow: newEscrowPda,
          authority: buyerKeypair.publicKey,
        })
        .signers([buyerKeypair])
        .rpc();

      // Release by arbiter
      const tx = await program.methods
        .release()
        .accounts({
          escrow: newEscrowPda,
          vault: newVaultPda,
          authority: arbiterKeypair.publicKey,
          sellerTokenAccount: sellerTokenAccount,
        })
        .signers([arbiterKeypair])
        .rpc();

      console.log("Arbiter release tx:", tx);

      // Verify release
      const escrowAccount = await program.account.escrowAccount.fetch(newEscrowPda);
      assert.equal(escrowAccount.state.released !== undefined, true);
      assert.equal(escrowAccount.releasedBy.toString(), arbiterKeypair.publicKey.toString());
    });
  });

  describe("Cancel Escrow", () => {
    it("Should cancel escrow and return funds", async () => {
      // Create new escrow for cancel test
      const cancelEscrowSeed = new anchor.BN(Date.now() + 300);
      const [cancelEscrowPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          buyerKeypair.publicKey.toBuffer(),
          cancelEscrowSeed.toArrayLike(Buffer, "le", 8)
        ],
        program.programId
      );
      const [cancelVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("vault"),
          buyerKeypair.publicKey.toBuffer(),
          cancelEscrowSeed.toArrayLike(Buffer, "le", 8)
        ],
        program.programId
      );

      // Initialize and deposit
      await program.methods
        .initializeEscrow(
          ESCROW_AMOUNT,
          cancelEscrowSeed,
          sellerKeypair.publicKey,
          "Cancel test",
          null
        )
        .accounts({
          escrow: cancelEscrowPda,
          vault: cancelVaultPda,
          buyer: buyerKeypair.publicKey,
          mint: mint,
        })
        .signers([buyerKeypair])
        .rpc();

      await program.methods
        .deposit()
        .accounts({
          escrow: cancelEscrowPda,
          vault: cancelVaultPda,
          depositor: buyerKeypair.publicKey,
          depositorTokenAccount: buyerTokenAccount,
        })
        .signers([buyerKeypair])
        .rpc();

      const buyerBalanceBefore = await getAccount(provider.connection, buyerTokenAccount);

      // Cancel escrow
      const tx = await program.methods
        .cancel()
        .accounts({
          escrow: cancelEscrowPda,
          vault: cancelVaultPda,
          authority: buyerKeypair.publicKey,
          buyerTokenAccount: buyerTokenAccount,
        })
        .signers([buyerKeypair])
        .rpc();

      console.log("Cancel tx:", tx);

      // Verify escrow state
      const escrowAccount = await program.account.escrowAccount.fetch(cancelEscrowPda);
      assert.equal(escrowAccount.state.cancelled !== undefined, true);
      assert.isNotNull(escrowAccount.cancelledAt);
      assert.equal(escrowAccount.cancelledBy.toString(), buyerKeypair.publicKey.toString());

      // Verify buyer got tokens back
      const buyerBalanceAfter = await getAccount(provider.connection, buyerTokenAccount);
      const expectedBalance = buyerBalanceBefore.amount + BigInt(ESCROW_AMOUNT.toString());
      assert.equal(buyerBalanceAfter.amount.toString(), expectedBalance.toString());
    });
  });

  describe("Update Conditions", () => {
    it("Should update conditions before funding", async () => {
      // Create new escrow
      const updateEscrowSeed = new anchor.BN(Date.now() + 400);
      const [updateEscrowPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          buyerKeypair.publicKey.toBuffer(),
          updateEscrowSeed.toArrayLike(Buffer, "le", 8)
        ],
        program.programId
      );
      const [updateVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("vault"),
          buyerKeypair.publicKey.toBuffer(),
          updateEscrowSeed.toArrayLike(Buffer, "le", 8)
        ],
        program.programId
      );

      // Initialize escrow
      await program.methods
        .initializeEscrow(
          ESCROW_AMOUNT,
          updateEscrowSeed,
          sellerKeypair.publicKey,
          "Original conditions",
          null
        )
        .accounts({
          escrow: updateEscrowPda,
          vault: updateVaultPda,
          buyer: buyerKeypair.publicKey,
          mint: mint,
        })
        .signers([buyerKeypair])
        .rpc();

      // Update conditions
      const newConditions = "Updated delivery requirements with tracking";
      const tx = await program.methods
        .updateConditions(newConditions)
        .accounts({
          escrow: updateEscrowPda,
          authority: buyerKeypair.publicKey,
        })
        .signers([buyerKeypair])
        .rpc();

      console.log("Update conditions tx:", tx);

      // Verify conditions updated
      const escrowAccount = await program.account.escrowAccount.fetch(updateEscrowPda);
      assert.equal(escrowAccount.releaseConditions, newConditions);
    });
  });

  describe("Timeout Release", () => {
    it("Should allow release after timeout", async () => {
      // Create escrow with short timeout
      const timeoutEscrowSeed = new anchor.BN(Date.now() + 500);
      const [timeoutEscrowPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          buyerKeypair.publicKey.toBuffer(),
          timeoutEscrowSeed.toArrayLike(Buffer, "le", 8)
        ],
        program.programId
      );
      const [timeoutVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("vault"),
          buyerKeypair.publicKey.toBuffer(),
          timeoutEscrowSeed.toArrayLike(Buffer, "le", 8)
        ],
        program.programId
      );

      // Initialize with 1 second timeout
      await program.methods
        .initializeEscrow(
          ESCROW_AMOUNT,
          timeoutEscrowSeed,
          sellerKeypair.publicKey,
          "Timeout test",
          new anchor.BN(1) // 1 second timeout
        )
        .accounts({
          escrow: timeoutEscrowPda,
          vault: timeoutVaultPda,
          buyer: buyerKeypair.publicKey,
          mint: mint,
        })
        .signers([buyerKeypair])
        .rpc();

      // Deposit
      await program.methods
        .deposit()
        .accounts({
          escrow: timeoutEscrowPda,
          vault: timeoutVaultPda,
          depositor: buyerKeypair.publicKey,
          depositorTokenAccount: buyerTokenAccount,
        })
        .signers([buyerKeypair])
        .rpc();

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Anyone should be able to release after timeout
      const tx = await program.methods
        .release()
        .accounts({
          escrow: timeoutEscrowPda,
          vault: timeoutVaultPda,
          authority: sellerKeypair.publicKey, // Even seller can release after timeout
          sellerTokenAccount: sellerTokenAccount,
        })
        .signers([sellerKeypair])
        .rpc();

      console.log("Timeout release tx:", tx);

      // Verify release
      const escrowAccount = await program.account.escrowAccount.fetch(timeoutEscrowPda);
      assert.equal(escrowAccount.state.released !== undefined, true);
    });
  });

  describe("Close Escrow", () => {
    it("Should close escrow and recover rent", async () => {
      // Use the first escrow which was already released
      const buyerBalanceBefore = await provider.connection.getBalance(buyerKeypair.publicKey);

      const tx = await program.methods
        .closeEscrow()
        .accounts({
          escrow: escrowPda,
          authority: buyerKeypair.publicKey,
        })
        .signers([buyerKeypair])
        .rpc();

      console.log("Close escrow tx:", tx);

      // Verify account is closed
      try {
        await program.account.escrowAccount.fetch(escrowPda);
        assert.fail("Expected account to be closed");
      } catch (error) {
        assert.include(error.message, "Account does not exist");
      }

      // Verify buyer got rent back
      const buyerBalanceAfter = await provider.connection.getBalance(buyerKeypair.publicKey);
      assert.isTrue(buyerBalanceAfter > buyerBalanceBefore);
    });
  });
});
