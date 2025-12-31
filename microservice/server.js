// microservice/server.js - REST API for Escrow System
// This allows any backend (PHP, Python, Go, etc.) to use the escrow system

const express = require('express');
const cors = require('cors');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { Program, AnchorProvider, BN, web3 } = require('@coral-xyz/anchor');
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = require('@solana/spl-token');

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
const PROGRAM_ID = process.env.PROGRAM_ID || "9pZmQesbcR58wxt3bncrm1S615sv2nr3LJYpcah1B6LB";
const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const PORT = process.env.PORT || 3001;

// Initialize connection
const connection = new Connection(RPC_URL, 'confirmed');

// Load IDL
const idl = require('../target/idl/escrow_system.json');

// Helper: Create provider from keypair
function createProvider(keypairArray) {
  const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairArray));
  const wallet = {
    publicKey: keypair.publicKey,
    signTransaction: async (tx) => { tx.sign([keypair]); return tx; },
    signAllTransactions: async (txs) => { txs.forEach(tx => tx.sign([keypair])); return txs; },
  };
  return new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
}

// Helper: Generate PDAs
function generatePDAs(buyer, escrowSeed, programId) {
  const [escrow] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), buyer.toBuffer(), escrowSeed.toArrayLike(Buffer, "le", 8)],
    programId
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), buyer.toBuffer(), escrowSeed.toArrayLike(Buffer, "le", 8)],
    programId
  );
  return { escrow, vault };
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', programId: PROGRAM_ID, rpcUrl: RPC_URL });
});

// Create escrow
app.post('/escrow/create', async (req, res) => {
  try {
    const { 
      buyerKeypair,  // Array of numbers (secret key)
      seller,        // Base58 public key string
      mint,          // Base58 public key string
      amount,        // Number (in smallest units)
      releaseConditions,
      timeoutSeconds // Optional
    } = req.body;

    const provider = createProvider(buyerKeypair);
    const programId = new PublicKey(PROGRAM_ID);
    const program = new Program(idl, programId, provider);
    
    const buyer = Keypair.fromSecretKey(Uint8Array.from(buyerKeypair));
    const escrowSeed = new BN(Date.now());
    const { escrow, vault } = generatePDAs(buyer.publicKey, escrowSeed, programId);

    const tx = await program.methods
      .initializeEscrow(
        new BN(amount),
        escrowSeed,
        new PublicKey(seller),
        releaseConditions || "Escrow agreement",
        timeoutSeconds ? new BN(timeoutSeconds) : null
      )
      .accounts({
        escrow,
        vault,
        buyer: buyer.publicKey,
        mint: new PublicKey(mint),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([buyer])
      .rpc();

    res.json({
      success: true,
      escrowId: escrow.toString(),
      vaultId: vault.toString(),
      escrowSeed: escrowSeed.toString(),
      transaction: tx,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Deposit funds
app.post('/escrow/deposit', async (req, res) => {
  try {
    const { buyerKeypair, escrowId, mint } = req.body;

    const provider = createProvider(buyerKeypair);
    const programId = new PublicKey(PROGRAM_ID);
    const program = new Program(idl, programId, provider);
    
    const buyer = Keypair.fromSecretKey(Uint8Array.from(buyerKeypair));
    const escrow = new PublicKey(escrowId);
    
    // Fetch escrow to get seed
    const escrowAccount = await program.account.escrowAccount.fetch(escrow);
    const { vault } = generatePDAs(buyer.publicKey, escrowAccount.escrowSeed, programId);
    
    const buyerTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(mint),
      buyer.publicKey
    );

    const tx = await program.methods
      .deposit()
      .accounts({
        escrow,
        vault,
        depositor: buyer.publicKey,
        depositorTokenAccount: buyerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([buyer])
      .rpc();

    res.json({ success: true, transaction: tx });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Release funds
app.post('/escrow/release', async (req, res) => {
  try {
    const { authorityKeypair, escrowId } = req.body;

    const provider = createProvider(authorityKeypair);
    const programId = new PublicKey(PROGRAM_ID);
    const program = new Program(idl, programId, provider);
    
    const authority = Keypair.fromSecretKey(Uint8Array.from(authorityKeypair));
    const escrow = new PublicKey(escrowId);
    
    // Fetch escrow data
    const escrowAccount = await program.account.escrowAccount.fetch(escrow);
    const { vault } = generatePDAs(escrowAccount.buyer, escrowAccount.escrowSeed, programId);
    
    const sellerTokenAccount = await getAssociatedTokenAddress(
      escrowAccount.mint,
      escrowAccount.seller
    );

    const tx = await program.methods
      .release()
      .accounts({
        escrow,
        vault,
        authority: authority.publicKey,
        sellerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();

    res.json({ success: true, transaction: tx });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancel escrow
app.post('/escrow/cancel', async (req, res) => {
  try {
    const { buyerKeypair, escrowId } = req.body;

    const provider = createProvider(buyerKeypair);
    const programId = new PublicKey(PROGRAM_ID);
    const program = new Program(idl, programId, provider);
    
    const buyer = Keypair.fromSecretKey(Uint8Array.from(buyerKeypair));
    const escrow = new PublicKey(escrowId);
    
    // Fetch escrow data
    const escrowAccount = await program.account.escrowAccount.fetch(escrow);
    const { vault } = generatePDAs(buyer.publicKey, escrowAccount.escrowSeed, programId);
    
    const buyerTokenAccount = await getAssociatedTokenAddress(
      escrowAccount.mint,
      buyer.publicKey
    );

    const tx = await program.methods
      .cancel()
      .accounts({
        escrow,
        vault,
        authority: buyer.publicKey,
        buyerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([buyer])
      .rpc();

    res.json({ success: true, transaction: tx });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get escrow info
app.get('/escrow/:escrowId', async (req, res) => {
  try {
    const programId = new PublicKey(PROGRAM_ID);
    const program = new Program(idl, programId, { connection });
    
    const escrow = new PublicKey(req.params.escrowId);
    const escrowAccount = await program.account.escrowAccount.fetch(escrow);

    res.json({
      success: true,
      escrow: {
        id: escrow.toString(),
        buyer: escrowAccount.buyer.toString(),
        seller: escrowAccount.seller.toString(),
        mint: escrowAccount.mint.toString(),
        amount: escrowAccount.amount.toString(),
        state: Object.keys(escrowAccount.state)[0],
        releaseConditions: escrowAccount.releaseConditions,
        createdAt: escrowAccount.createdAt.toString(),
        fundedAt: escrowAccount.fundedAt?.toString(),
        timeoutAt: escrowAccount.timeoutAt?.toString(),
        arbiter: escrowAccount.arbiter?.toString(),
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Set arbiter
app.post('/escrow/set-arbiter', async (req, res) => {
  try {
    const { buyerKeypair, escrowId, arbiter } = req.body;

    const provider = createProvider(buyerKeypair);
    const programId = new PublicKey(PROGRAM_ID);
    const program = new Program(idl, programId, provider);
    
    const buyer = Keypair.fromSecretKey(Uint8Array.from(buyerKeypair));
    const escrow = new PublicKey(escrowId);

    const tx = await program.methods
      .setArbiter(new PublicKey(arbiter))
      .accounts({
        escrow,
        authority: buyer.publicKey,
      })
      .signers([buyer])
      .rpc();

    res.json({ success: true, transaction: tx });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Escrow Microservice running on port ${PORT}`);
  console.log(`Program ID: ${PROGRAM_ID}`);
  console.log(`RPC URL: ${RPC_URL}`);
});

module.exports = app;

