// client/escrow-client.ts - Client SDK for interacting with the escrow program
import * as anchor from "@coral-xyz/anchor";
import { Program, BN, web3 } from "@coral-xyz/anchor";
import { EscrowSystem } from "../target/types/escrow_system";
import { 
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";

export interface EscrowConfig {
  amount: BN;
  seller: web3.PublicKey;
  mint: web3.PublicKey;
  releaseConditions: string;
  timeoutDuration?: BN; // Optional timeout in seconds
}

export interface EscrowInfo {
  escrow: web3.PublicKey;
  vault: web3.PublicKey;
  buyer: web3.PublicKey;
  seller: web3.PublicKey;
  mint: web3.PublicKey;
  amount: BN;
  state: string;
  releaseConditions: string;
  createdAt: BN;
  fundedAt?: BN;
  timeoutAt?: BN;
  releasedAt?: BN;
  cancelledAt?: BN;
  arbiter?: web3.PublicKey;
}

export class EscrowClient {
  private program: Program<EscrowSystem>;
  private provider: anchor.AnchorProvider;

  constructor(program: Program<EscrowSystem>, provider: anchor.AnchorProvider) {
    this.program = program;
    this.provider = provider;
  }

  /**
   * Generate escrow PDAs
   */
  generateEscrowPDAs(buyer: web3.PublicKey, escrowSeed: BN): {
    escrow: web3.PublicKey;
    vault: web3.PublicKey;
    escrowBump: number;
    vaultBump: number;
  } {
    const [escrow, escrowBump] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        buyer.toBuffer(),
        escrowSeed.toArrayLike(Buffer, "le", 8)
      ],
      this.program.programId
    );

    const [vault, vaultBump] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault"),
        buyer.toBuffer(),
        escrowSeed.toArrayLike(Buffer, "le", 8)
      ],
      this.program.programId
    );

    return { escrow, vault, escrowBump, vaultBump };
  }

  /**
   * Initialize a new escrow
   */
  async initializeEscrow(
    buyer: web3.Keypair,
    config: EscrowConfig,
    escrowSeed?: BN
  ): Promise<{
    signature: string;
    escrow: web3.PublicKey;
    vault: web3.PublicKey;
    escrowSeed: BN;
  }> {
    const seed = escrowSeed || new BN(Date.now());
    const { escrow, vault } = this.generateEscrowPDAs(buyer.publicKey, seed);

    const signature = await this.program.methods
      .initializeEscrow(
        config.amount,
        seed,
        config.seller,
        config.releaseConditions,
        config.timeoutDuration || null
      )
      .accounts({
        escrow,
        vault,
        buyer: buyer.publicKey,
        mint: config.mint,
      })
      .signers([buyer])
      .rpc();

    return { signature, escrow, vault, escrowSeed: seed };
  }

  /**
   * Deposit funds into escrow
   */
  async deposit(
    buyer: web3.Keypair,
    escrow: web3.PublicKey,
    mint: web3.PublicKey
  ): Promise<string> {
    const escrowAccount = await this.program.account.escrowAccount.fetch(escrow);
    const { vault } = this.generateEscrowPDAs(buyer.publicKey, escrowAccount.escrowSeed);
    
    const buyerTokenAccount = await getAssociatedTokenAddress(
      mint,
      buyer.publicKey
    );

    const signature = await this.program.methods
      .deposit()
      .accounts({
        escrow,
        vault,
        depositor: buyer.publicKey,
        depositorTokenAccount: buyerTokenAccount,
      })
      .signers([buyer])
      .rpc();

    return signature;
  }

  /**
   * Release funds to seller
   */
  async releaseFunds(
    authority: web3.Keypair,
    escrow: web3.PublicKey
  ): Promise<string> {
    const escrowAccount = await this.program.account.escrowAccount.fetch(escrow);
    const { vault } = this.generateEscrowPDAs(escrowAccount.buyer, escrowAccount.escrowSeed);
    
    const sellerTokenAccount = await getAssociatedTokenAddress(
      escrowAccount.mint,
      escrowAccount.seller
    );

    const signature = await this.program.methods
      .release()
      .accounts({
        escrow,
        vault,
        authority: authority.publicKey,
        sellerTokenAccount,
      })
      .signers([authority])
      .rpc();

    return signature;
  }

  /**
   * Cancel escrow and return funds
   */
  async cancelEscrow(
    authority: web3.Keypair,
    escrow: web3.PublicKey
  ): Promise<string> {
    const escrowAccount = await this.program.account.escrowAccount.fetch(escrow);
    const { vault } = this.generateEscrowPDAs(escrowAccount.buyer, escrowAccount.escrowSeed);
    
    const buyerTokenAccount = await getAssociatedTokenAddress(
      escrowAccount.mint,
      escrowAccount.buyer
    );

    const signature = await this.program.methods
      .cancel()
      .accounts({
        escrow,
        vault,
        authority: authority.publicKey,
        buyerTokenAccount,
      })
      .signers([authority])
      .rpc();

    return signature;
  }

  /**
   * Set arbiter for dispute resolution
   */
  async setArbiter(
    buyer: web3.Keypair,
    escrow: web3.PublicKey,
    arbiter: web3.PublicKey
  ): Promise<string> {
    const signature = await this.program.methods
      .setArbiter(arbiter)
      .accounts({
        escrow,
        authority: buyer.publicKey,
      })
      .signers([buyer])
      .rpc();

    return signature;
  }

  /**
   * Update release conditions
   */
  async updateConditions(
    buyer: web3.Keypair,
    escrow: web3.PublicKey,
    newConditions: string
  ): Promise<string> {
    const signature = await this.program.methods
      .updateConditions(newConditions)
      .accounts({
        escrow,
        authority: buyer.publicKey,
      })
      .signers([buyer])
      .rpc();

    return signature;
  }

  /**
   * Close escrow account and recover rent
   */
  async closeEscrow(
    buyer: web3.Keypair,
    escrow: web3.PublicKey
  ): Promise<string> {
    const signature = await this.program.methods
      .closeEscrow()
      .accounts({
        escrow,
        authority: buyer.publicKey,
      })
      .signers([buyer])
      .rpc();

    return signature;
  }

  /**
   * Get escrow information
   */
  async getEscrowInfo(escrow: web3.PublicKey): Promise<EscrowInfo> {
    const account = await this.program.account.escrowAccount.fetch(escrow);
    const { vault } = this.generateEscrowPDAs(account.buyer, account.escrowSeed);

    return {
      escrow,
      vault,
      buyer: account.buyer,
      seller: account.seller,
      mint: account.mint,
      amount: account.amount,
      state: Object.keys(account.state)[0],
      releaseConditions: account.releaseConditions,
      createdAt: account.createdAt,
      fundedAt: account.fundedAt,
      timeoutAt: account.timeoutAt,
      releasedAt: account.releasedAt,
      cancelledAt: account.cancelledAt,
      arbiter: account.arbiter,
    };
  }

  /**
   * Get all escrows for a buyer
   */
  async getEscrowsForBuyer(buyer: web3.PublicKey): Promise<EscrowInfo[]> {
    const escrows = await this.program.account.escrowAccount.all([
      {
        memcmp: {
          offset: 8, // Skip discriminator
          bytes: buyer.toBase58(),
        },
      },
    ]);

    return escrows.map(escrow => {
      const account = escrow.account;
      const { vault } = this.generateEscrowPDAs(account.buyer, account.escrowSeed);

      return {
        escrow: escrow.publicKey,
        vault,
        buyer: account.buyer,
        seller: account.seller,
        mint: account.mint,
        amount: account.amount,
        state: Object.keys(account.state)[0],
        releaseConditions: account.releaseConditions,
        createdAt: account.createdAt,
        fundedAt: account.fundedAt,
        timeoutAt: account.timeoutAt,
        releasedAt: account.releasedAt,
        cancelledAt: account.cancelledAt,
        arbiter: account.arbiter,
      };
    });
  }

  /**
   * Get all escrows for a seller
   */
  async getEscrowsForSeller(seller: web3.PublicKey): Promise<EscrowInfo[]> {
    const escrows = await this.program.account.escrowAccount.all([
      {
        memcmp: {
          offset: 8 + 32, // Skip discriminator and buyer
          bytes: seller.toBase58(),
        },
      },
    ]);

    return escrows.map(escrow => {
      const account = escrow.account;
      const { vault } = this.generateEscrowPDAs(account.buyer, account.escrowSeed);

      return {
        escrow: escrow.publicKey,
        vault,
        buyer: account.buyer,
        seller: account.seller,
        mint: account.mint,
        amount: account.amount,
        state: Object.keys(account.state)[0],
        releaseConditions: account.releaseConditions,
        createdAt: account.createdAt,
        fundedAt: account.fundedAt,
        timeoutAt: account.timeoutAt,
        releasedAt: account.releasedAt,
        cancelledAt: account.cancelledAt,
        arbiter: account.arbiter,
      };
    });
  }

  /**
   * Listen to escrow events
   */
  addEventListener(
    event: "EscrowCreated" | "EscrowFunded" | "EscrowReleased" | "EscrowCancelled" | "ArbiterSet" | "ConditionsUpdated",
    callback: (event: any, slot: number, signature: string) => void
  ): number {
    return this.program.addEventListener(event, callback);
  }

  /**
   * Remove event listener
   */
  async removeEventListener(listenerId: number): Promise<void> {
    await this.program.removeEventListener(listenerId);
  }

  /**
   * Create associated token account if it doesn't exist
   */
  async createAssociatedTokenAccountIfNeeded(
    payer: web3.Keypair,
    owner: web3.PublicKey,
    mint: web3.PublicKey
  ): Promise<{ instruction?: web3.TransactionInstruction; address: web3.PublicKey }> {
    const address = await getAssociatedTokenAddress(mint, owner);
    
    try {
      const account = await this.provider.connection.getAccountInfo(address);
      if (account) {
        return { address };
      }
    } catch (error) {
      // Account doesn't exist, create it
    }

    const instruction = createAssociatedTokenAccountInstruction(
      payer.publicKey,
      address,
      owner,
      mint
    );

    return { instruction, address };
  }

  /**
   * Utility method to check if escrow has timed out
   */
  isTimedOut(escrowInfo: EscrowInfo): boolean {
    if (!escrowInfo.timeoutAt) return false;
    
    const currentTimestamp = Math.floor(Date.now() / 1000);
    return currentTimestamp >= escrowInfo.timeoutAt.toNumber();
  }

  /**
   * Get time remaining until timeout
   */
  getTimeUntilTimeout(escrowInfo: EscrowInfo): number | null {
    if (!escrowInfo.timeoutAt) return null;
    
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const timeRemaining = escrowInfo.timeoutAt.toNumber() - currentTimestamp;
    
    return Math.max(0, timeRemaining);
  }
}

// Example usage
export async function createEscrowClient(
  connection: web3.Connection,
  wallet: any, // Can be any wallet adapter
  programId: web3.PublicKey
): Promise<EscrowClient> {
  const provider = new anchor.AnchorProvider(
    connection,
    wallet,
    anchor.AnchorProvider.defaultOptions()
  );

  // Load the program IDL
  const idl = await anchor.Program.fetchIdl(programId, provider);
  const program = new anchor.Program(idl as any, programId, provider);

  return new EscrowClient(program, provider);
}
