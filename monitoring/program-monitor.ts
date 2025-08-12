// monitoring/program-monitor.ts
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';

interface MonitoringConfig {
  programId: string;
  rpcEndpoint: string;
  alertWebhook?: string;
  checkIntervalMs: number;
}

export class ProgramMonitor {
  private connection: Connection;
  private programId: PublicKey;
  private config: MonitoringConfig;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.connection = new Connection(config.rpcEndpoint);
    this.programId = new PublicKey(config.programId);
  }

  async start() {
    console.log(`Starting program monitor for ${this.programId}`);
    
    setInterval(async () => {
      try {
        await this.checkProgramHealth();
        await this.checkEscrowStats();
      } catch (error) {
        console.error('Monitoring error:', error);
        await this.sendAlert('Monitoring Error', error.message);
      }
    }, this.config.checkIntervalMs);
  }

  private async checkProgramHealth() {
    const accountInfo = await this.connection.getAccountInfo(this.programId);
    
    if (!accountInfo) {
      await this.sendAlert('Critical', 'Program account not found!');
      return;
    }

    if (!accountInfo.executable) {
      await this.sendAlert('Critical', 'Program is not executable!');
      return;
    }

    console.log(`✅ Program health check passed`);
  }

  private async checkEscrowStats() {
    try {
      const accounts = await this.connection.getProgramAccounts(this.programId);
      
      const stats = {
        totalEscrows: accounts.length,
        timestamp: new Date().toISOString(),
      };

      console.log(`📊 Escrow stats:`, stats);

      // Check for suspicious activity
      if (accounts.length > 10000) {
        await this.sendAlert('Warning', `High number of escrows: ${accounts.length}`);
      }

    } catch (error) {
      console.error('Failed to fetch escrow stats:', error);
    }
  }

  private async sendAlert(level: string, message: string) {
    const alert = {
      level,
      message,
      program: this.programId.toString(),
      timestamp: new Date().toISOString(),
    };

    console.log(`🚨 ${level}: ${message}`);

    if (this.config.alertWebhook) {
      try {
        await fetch(this.config.alertWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert),
        });
      } catch (error) {
        console.error('Failed to send webhook alert:', error);
      }
    }
  }
}

// Usage
const monitor = new ProgramMonitor({
  programId: 'EscrowProgram11111111111111111111111111111', // Replace with your program ID
  rpcEndpoint: 'https://api.mainnet-beta.solana.com',
  alertWebhook: process.env.SLACK_WEBHOOK_URL, // Optional Slack webhook
  checkIntervalMs: 60000, // 1 minute
});

if (require.main === module) {
  monitor.start().catch(console.error);
}

export default monitor;
