// frontend/escrow-ui.tsx - React component example
import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { EscrowClient, EscrowInfo, createEscrowClient } from '../client/escrow-client';
import { toast } from 'react-hot-toast';

interface EscrowUIProps {
  programId: string;
}

export const EscrowUI: React.FC<EscrowUIProps> = ({ programId }) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [escrowClient, setEscrowClient] = useState<EscrowClient | null>(null);
  const [userEscrows, setUserEscrows] = useState<EscrowInfo[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    amount: '',
    seller: '',
    mint: '',
    conditions: '',
    timeoutHours: '',
  });

  useEffect(() => {
    if (wallet.publicKey && connection) {
      initializeClient();
    }
  }, [wallet.publicKey, connection]);

  const initializeClient = async () => {
    try {
      const client = await createEscrowClient(
        connection,
        wallet,
        new PublicKey(programId)
      );
      setEscrowClient(client);
      await loadUserEscrows(client);
    } catch (error) {
      console.error('Failed to initialize escrow client:', error);
      toast.error('Failed to connect to escrow program');
    }
  };

  const loadUserEscrows = async (client: EscrowClient) => {
    if (!wallet.publicKey) return;
    
    try {
      const buyerEscrows = await client.getEscrowsForBuyer(wallet.publicKey);
      const sellerEscrows = await client.getEscrowsForSeller(wallet.publicKey);
      
      // Combine and deduplicate
      const allEscrows = [...buyerEscrows, ...sellerEscrows];
      const uniqueEscrows = allEscrows.filter((escrow, index, self) => 
        index === self.findIndex(e => e.escrow.equals(escrow.escrow))
      );
      
      setUserEscrows(uniqueEscrows);
    } catch (error) {
      console.error('Failed to load escrows:', error);
    }
  };

  const handleCreateEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escrowClient || !wallet.signTransaction) return;

    setLoading(true);
    try {
      const config = {
        amount: new BN(parseFloat(formData.amount) * 1000000), // Assuming 6 decimals
        seller: new PublicKey(formData.seller),
        mint: new PublicKey(formData.mint),
        releaseConditions: formData.conditions,
        timeoutDuration: formData.timeoutHours ? 
          new BN(parseInt(formData.timeoutHours) * 3600) : undefined,
      };

      const result = await escrowClient.initializeEscrow(
        wallet as any, // Type assertion for demo
        config
      );

      toast.success(`Escrow created! ID: ${result.escrow.toString().slice(0, 8)}...`);
      
      // Reset form
      setFormData({
        amount: '',
        seller: '',
        mint: '',
        conditions: '',
        timeoutHours: '',
      });

      // Reload escrows
      await loadUserEscrows(escrowClient);
    } catch (error) {
      console.error('Failed to create escrow:', error);
      toast.error('Failed to create escrow');
    } finally {
      setLoading(false);
    }
  };

  const handleDepositFunds = async (escrow: PublicKey, mint: PublicKey) => {
    if (!escrowClient) return;

    setLoading(true);
    try {
      const signature = await escrowClient.deposit(wallet as any, escrow, mint);
      toast.success(`Funds deposited! Tx: ${signature.slice(0, 8)}...`);
      await loadUserEscrows(escrowClient);
    } catch (error) {
      console.error('Failed to deposit:', error);
      toast.error('Failed to deposit funds');
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseFunds = async (escrow: PublicKey) => {
    if (!escrowClient) return;

    setLoading(true);
    try {
      const signature = await escrowClient.releaseFunds(wallet as any, escrow);
      toast.success(`Funds released! Tx: ${signature.slice(0, 8)}...`);
      await loadUserEscrows(escrowClient);
    } catch (error) {
      console.error('Failed to release:', error);
      toast.error('Failed to release funds');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEscrow = async (escrow: PublicKey) => {
    if (!escrowClient) return;

    setLoading(true);
    try {
      const signature = await escrowClient.cancelEscrow(wallet as any, escrow);
      toast.success(`Escrow cancelled! Tx: ${signature.slice(0, 8)}...`);
      await loadUserEscrows(escrowClient);
    } catch (error) {
      console.error('Failed to cancel:', error);
      toast.error('Failed to cancel escrow');
    } finally {
      setLoading(false);
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'initialized': return 'bg-yellow-100 text-yellow-800';
      case 'funded': return 'bg-blue-100 text-blue-800';
      case 'released': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatAmount = (amount: BN, decimals: number = 6) => {
    return (amount.toNumber() / Math.pow(10, decimals)).toFixed(2);
  };

  if (!wallet.connected) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
        <p className="text-gray-600">Please connect your Solana wallet to use the escrow system.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Solana Escrow System</h1>
      
      {/* Create Escrow Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Create New Escrow</h2>
        <form onSubmit={handleCreateEscrow} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount (tokens)
            </label>
            <input
              type="number"
              step="0.000001"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded-md"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seller Address
            </label>
            <input
              type="text"
              value={formData.seller}
              onChange={(e) => setFormData({...formData, seller: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Enter seller's public key"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Token Mint Address
            </label>
            <input
              type="text"
              value={formData.mint}
              onChange={(e) => setFormData({...formData, mint: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Enter token mint address"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Timeout (hours, optional)
            </label>
            <input
              type="number"
              value={formData.timeoutHours}
              onChange={(e) => setFormData({...formData, timeoutHours: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Auto-release timeout"
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Release Conditions
            </label>
            <textarea
              value={formData.conditions}
              onChange={(e) => setFormData({...formData, conditions: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded-md"
              rows={3}
              placeholder="Describe the conditions for releasing funds..."
              required
            />
          </div>
          
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Escrow'}
            </button>
          </div>
        </form>
      </div>
      
      {/* Escrows List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Your Escrows ({userEscrows.length})</h2>
        
        {userEscrows.length === 0 ? (
          <p className="text-gray-500">No escrows found. Create your first escrow above!</p>
        ) : (
          <div className="grid gap-4">
            {userEscrows.map((escrow) => (
              <div key={escrow.escrow.toString()} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-mono text-sm text-gray-600">
                      {escrow.escrow.toString()}
                    </p>
                    <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getStateColor(escrow.state)}`}>
                      {escrow.state.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">
                      {formatAmount(escrow.amount)} tokens
                    </p>
                    <p className="text-sm text-gray-500">
                      Created: {new Date(escrow.createdAt.toNumber() * 1000).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="mb-3">
                  <p className="text-sm text-gray-600 mb-1">Release Conditions:</p>
                  <p className="text-sm bg-gray-50 p-2 rounded">{escrow.releaseConditions}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <p className="font-medium">Buyer:</p>
                    <p className="font-mono text-xs">{escrow.buyer.toString().slice(0, 16)}...</p>
                  </div>
                  <div>
                    <p className="font-medium">Seller:</p>
                    <p className="font-mono text-xs">{escrow.seller.toString().slice(0, 16)}...</p>
                  </div>
                </div>
                
                {escrow.timeoutAt && (
                  <div className="mb-3">
                    <p className="text-sm text-gray-600">
                      Timeout: {new Date(escrow.timeoutAt.toNumber() * 1000).toLocaleString()}
                    </p>
                    {escrowClient && (
                      <p className="text-sm text-orange-600">
                        {escrowClient.isTimedOut(escrow) ? 
                          'Timed out - can be released by anyone' : 
                          `${escrowClient.getTimeUntilTimeout(escrow)} seconds remaining`
                        }
                      </p>
                    )}
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex gap-2 pt-3 border-t">
                  {escrow.state === 'initialized' && escrow.buyer.equals(wallet.publicKey!) && (
                    <button
                      onClick={() => handleDepositFunds(escrow.escrow, escrow.mint)}
                      disabled={loading}
                      className="bg-green-600 text-white px-3 py-1 text-sm rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      Deposit Funds
                    </button>
                  )}
                  
                  {escrow.state === 'funded' && (
                    <>
                      <button
                        onClick={() => handleReleaseFunds(escrow.escrow)}
                        disabled={loading}
                        className="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        Release Funds
                      </button>
                      
                      {escrow.buyer.equals(wallet.publicKey!) && (
                        <button
                          onClick={() => handleCancelEscrow(escrow.escrow)}
                          disabled={loading}
                          className="bg-red-600 text-white px-3 py-1 text-sm rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          Cancel Escrow
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
