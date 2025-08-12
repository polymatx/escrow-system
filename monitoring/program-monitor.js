// monitoring/program-monitor.js - Simple monitoring for the escrow program
const { Connection, PublicKey } = require('@solana/web3.js');

const PROGRAM_ID = "7a6GBPdjMAfHTKtE4BqzDaynLUBLXpWzSJsVaAo5rMgj";
const RPC_URL = "http://localhost:8899";

class EscrowMonitor {
  constructor() {
    this.connection = new Connection(RPC_URL, 'confirmed');
    this.programId = new PublicKey(PROGRAM_ID);
    this.isRunning = false;
    this.consecutiveErrors = 0;
  }

  async start() {
    console.log("📊 Starting Escrow System Monitor...");
    console.log("Program ID:", PROGRAM_ID);
    console.log("RPC URL:", RPC_URL);
    console.log("================================");
    
    this.isRunning = true;
    
    // Wait a moment for connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check program account
    await this.checkProgramHealth();
    
    // Start monitoring loop
    this.monitorLoop();
  }

  async checkProgramHealth() {
    try {
      // First check if RPC is responding
      const version = await this.connection.getVersion();
      console.log("✅ RPC Connection: Active (Solana", version["solana-core"], ")");
      
      const programAccount = await this.connection.getAccountInfo(this.programId);
      
      if (programAccount) {
        console.log("✅ Program Account Status:");
        console.log(`   Executable: ${programAccount.executable}`);
        console.log(`   Owner: ${programAccount.owner.toString()}`);
        console.log(`   Lamports: ${programAccount.lamports}`);
        console.log(`   Data Length: ${programAccount.data.length} bytes`);
        this.consecutiveErrors = 0;
      } else {
        console.log("❌ Program account not found! Make sure it's deployed.");
        this.consecutiveErrors++;
      }
    } catch (error) {
      console.error("❌ Error checking program health:", error.message);
      this.consecutiveErrors++;
      
      if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
        console.log("⚠️ Validator might not be running. Try: solana-test-validator --reset");
      }
    }
  }

  async monitorLoop() {
    let totalAccounts = 0;
    let lastCheck = Date.now();
    
    while (this.isRunning) {
      try {
        // Get all program accounts (escrows)
        const accounts = await this.connection.getProgramAccounts(this.programId);
        const currentTime = new Date().toLocaleTimeString();
        
        if (accounts.length !== totalAccounts) {
          console.log(`[${currentTime}] 📊 Total escrows: ${accounts.length} ${accounts.length > totalAccounts ? '(+' + (accounts.length - totalAccounts) + ')' : ''}`);
          totalAccounts = accounts.length;
        }
        
        // Show periodic health check
        if (Date.now() - lastCheck > 30000) { // Every 30 seconds
          console.log(`[${currentTime}] 💚 System healthy - ${totalAccounts} escrows active`);
          lastCheck = Date.now();
        }
        
      } catch (error) {
        console.error(`[${new Date().toLocaleTimeString()}] ❌ Monitor error:`, error.message);
      }
      
      // Wait 5 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  stop() {
    console.log("🛑 Stopping monitor...");
    this.isRunning = false;
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start monitoring
const monitor = new EscrowMonitor();
monitor.start().catch(console.error);

module.exports = { EscrowMonitor };
