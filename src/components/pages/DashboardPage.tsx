'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWalletContext } from '@/context/WalletContext';
import { getSOLBalance } from '@/lib/solana';
import { getSOLPrice, formatUSD } from '@/lib/price';
import { Toast } from '@/components/ui/Toast';

export function DashboardPage() {
  const { wallet, setCurrentPage, rpcEndpoint, lockWallet } = useWalletContext();
  const [balance, setBalance] = useState<number>(0);
  const [solPrice, setSolPrice] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!wallet) return;
    setIsLoadingBalance(true);
    try {
      const [bal, price] = await Promise.all([
        getSOLBalance(wallet.publicKey, rpcEndpoint).catch(() => 0),
        getSOLPrice().catch(() => 0),
      ]);
      setBalance(bal);
      setSolPrice(price);
    } catch {
      setBalance(0);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [wallet, rpcEndpoint]);

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  const handleCopyAddress = async () => {
    if (wallet) {
      await navigator.clipboard.writeText(wallet.publicKey);
      setToast({ message: 'Address copied to clipboard', type: 'success' });
    }
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!wallet) return null;

  const usdValue = balance * solPrice;

  return (
    <div className="min-h-screen flex flex-col p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-grokie-orange to-grokie-orange-dark flex items-center justify-center">
            <img src="/logo.png" alt="GROKIE" className="w-8 h-8 rounded-lg object-contain" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">{wallet.name}</h2>
            <button
              onClick={handleCopyAddress}
              className="text-xs text-gray-400 hover:text-grokie-orange transition-colors flex items-center gap-1"
            >
              {shortenAddress(wallet.publicKey)}
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={lockWallet}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Lock Wallet"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </button>
          <button
            onClick={() => setCurrentPage('settings')}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Settings"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Balance Card */}
      <div className="card mb-6 text-center">
        <p className="text-sm text-gray-400 mb-1">Total Balance</p>
        {isLoadingBalance ? (
          <div className="h-16 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-grokie-light-gray border-t-grokie-orange rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <h1 className="text-4xl font-bold">
              {balance === 0 ? '0' : balance.toFixed(4)}
            </h1>
            <p className="text-lg text-gray-400 mt-1">
              {formatUSD(usdValue)}
            </p>
          </>
        )}
        <button
          onClick={fetchBalance}
          className="mt-3 text-xs text-grokie-orange hover:text-grokie-orange-light transition-colors"
        >
          Refresh Balance
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        <button
          onClick={() => setCurrentPage('send')}
          className="card flex flex-col items-center gap-2 py-4 hover:border-grokie-orange/50 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-grokie-orange/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-grokie-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
            </svg>
          </div>
          <span className="text-xs font-medium">Send</span>
        </button>

        <button
          onClick={() => setCurrentPage('receive')}
          className="card flex flex-col items-center gap-2 py-4 hover:border-grokie-orange/50 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
            </svg>
          </div>
          <span className="text-xs font-medium">Receive</span>
        </button>

        <button
          onClick={() => setCurrentPage('swap')}
          className="card flex flex-col items-center gap-2 py-4 hover:border-grokie-orange/50 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </div>
          <span className="text-xs font-medium">Swap</span>
        </button>

        <button
          onClick={() => setCurrentPage('assets')}
          className="card flex flex-col items-center gap-2 py-4 hover:border-grokie-orange/50 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <span className="text-xs font-medium">Assets</span>
        </button>
      </div>

      {/* Transaction History Button */}
      <button
        onClick={() => setCurrentPage('transactions')}
        className="card flex items-center justify-between hover:border-grokie-orange/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="font-medium">Transaction History</span>
        </div>
        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
