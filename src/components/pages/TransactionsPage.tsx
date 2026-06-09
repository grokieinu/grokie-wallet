'use client';

import { useState, useEffect } from 'react';
import { useWalletContext } from '@/context/WalletContext';
import { getRecentTransactions, getExplorerUrl } from '@/lib/solana';
import { getTransactions, type TransactionRecord } from '@/lib/storage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface DisplayTransaction {
  signature: string;
  type: 'send' | 'receive' | 'unknown';
  amount?: number;
  token?: string;
  timestamp: number;
  status: 'confirmed' | 'failed' | 'pending';
}

export function TransactionsPage() {
  const { wallet, setCurrentPage, rpcEndpoint } = useWalletContext();
  const [transactions, setTransactions] = useState<DisplayTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!wallet) return;
      setIsLoading(true);

      try {
        // Merge local records with on-chain signatures
        const [localTxs, onChainSigs] = await Promise.all([
          getTransactions(wallet.id),
          getRecentTransactions(wallet.publicKey, 20, rpcEndpoint).catch(() => []),
        ]);

        const localMap = new Map(localTxs.map((tx) => [tx.signature, tx]));
        const merged: DisplayTransaction[] = [];

        // Add on-chain transactions
        for (const sig of onChainSigs) {
          const local = localMap.get(sig.signature);
          if (local) {
            merged.push({
              signature: local.signature,
              type: local.type,
              amount: local.amount,
              token: local.token,
              timestamp: local.timestamp,
              status: local.status,
            });
            localMap.delete(sig.signature);
          } else {
            merged.push({
              signature: sig.signature,
              type: 'unknown',
              timestamp: (sig.blockTime || 0) * 1000,
              status: sig.err ? 'failed' : 'confirmed',
            });
          }
        }

        // Add remaining local transactions not found on chain
        for (const local of localMap.values()) {
          merged.push({
            signature: local.signature,
            type: local.type,
            amount: local.amount,
            token: local.token,
            timestamp: local.timestamp,
            status: local.status,
          });
        }

        // Sort by timestamp descending
        merged.sort((a, b) => b.timestamp - a.timestamp);
        setTransactions(merged);
      } catch {
        setTransactions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, [wallet, rpcEndpoint]);

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!wallet) return null;

  return (
    <div className="min-h-screen flex flex-col p-6 animate-fade-in">
      <div className="w-full max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setCurrentPage('dashboard')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">Transactions</h1>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner text="Loading transactions..." />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-400">No transactions yet</p>
            <p className="text-xs text-gray-500 mt-1">Transactions will appear here once you start sending or receiving.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <a
                key={tx.signature}
                href={getExplorerUrl(tx.signature)}
                target="_blank"
                rel="noopener noreferrer"
                className="card flex items-center justify-between hover:border-grokie-orange/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    tx.type === 'send' ? 'bg-red-500/20' : tx.type === 'receive' ? 'bg-green-500/20' : 'bg-gray-500/20'
                  }`}>
                    {tx.type === 'send' ? (
                      <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                      </svg>
                    ) : tx.type === 'receive' ? (
                      <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {tx.type === 'unknown' ? 'Transaction' : tx.type}
                    </p>
                    <p className="text-xs text-gray-500">{formatDate(tx.timestamp)}</p>
                  </div>
                </div>
                <div className="text-right">
                  {tx.amount && (
                    <p className={`text-sm font-semibold ${tx.type === 'send' ? 'text-red-400' : 'text-green-400'}`}>
                      {tx.type === 'send' ? '-' : '+'}{tx.amount} {tx.token || 'SOL'}
                    </p>
                  )}
                  <p className={`text-xs ${tx.status === 'confirmed' ? 'text-green-500' : tx.status === 'failed' ? 'text-red-500' : 'text-yellow-500'}`}>
                    {tx.status}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
