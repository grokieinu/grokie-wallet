'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWalletContext } from '@/context/WalletContext';
import { getSOLBalance, getSPLTokenBalances, getTokenBalanceForMint, type TokenBalance } from '@/lib/solana';
import { getCustomTokens, deleteCustomToken, type CustomTokenRecord } from '@/lib/storage';
import { getSOLPrice, getTokenPrices, formatUSD } from '@/lib/price';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { TokenIcon } from '@/components/ui/TokenIcon';
import { Toast } from '@/components/ui/Toast';

interface CustomTokenDisplay extends CustomTokenRecord {
  balance: number;
  uiBalance: string;
}

export function AssetsPage() {
  const { wallet, setCurrentPage, rpcEndpoint } = useWalletContext();
  const [solBalance, setSolBalance] = useState<number>(0);
  const [solPrice, setSolPrice] = useState<number>(0);
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [tokenPrices, setTokenPrices] = useState<Map<string, number>>(new Map());
  const [customTokens, setCustomTokens] = useState<CustomTokenDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const fetchAssets = useCallback(async (showLoading = false) => {
    if (!wallet) return;
    if (showLoading) setIsLoading(true);
    try {
      const [sol, price, splTokens, savedTokens] = await Promise.all([
        getSOLBalance(wallet.publicKey, rpcEndpoint).catch(() => 0),
        getSOLPrice().catch(() => 0),
        getSPLTokenBalances(wallet.publicKey, rpcEndpoint).catch(() => []),
        getCustomTokens(wallet.id).catch(() => []),
      ]);
      setSolBalance(sol);
      setSolPrice(price);
      setTokens(splTokens);

      // Fetch prices for all tokens
      const allMints = [
        ...splTokens.map((t) => t.mint),
        ...savedTokens.map((t) => t.mintAddress),
      ];
      if (allMints.length > 0) {
        const prices = await getTokenPrices(allMints).catch(() => new Map<string, number>());
        setTokenPrices(prices);
      }

      // Fetch balances for custom tokens
      if (savedTokens.length > 0) {
        const customWithBalances: CustomTokenDisplay[] = await Promise.all(
          savedTokens.map(async (ct) => {
            try {
              const balanceInfo = await getTokenBalanceForMint(
                wallet.publicKey,
                ct.mintAddress,
                rpcEndpoint
              );
              return {
                ...ct,
                balance: balanceInfo?.balance || 0,
                uiBalance: balanceInfo?.uiBalance || '0',
              };
            } catch {
              return { ...ct, balance: 0, uiBalance: '0' };
            }
          })
        );
        setCustomTokens(customWithBalances);
      }
    } catch {
      setSolBalance(0);
    } finally {
      setIsLoading(false);
    }
  }, [wallet, rpcEndpoint]);

  useEffect(() => {
    fetchAssets(true);
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchAssets(false), 30000);
    return () => clearInterval(interval);
  }, [fetchAssets]);

  const handleRemoveToken = async (tokenId: string, symbolName: string) => {
    await deleteCustomToken(tokenId);
    setCustomTokens((prev) => prev.filter((t) => t.id !== tokenId));
    setToast({ message: `${symbolName} removed`, type: 'info' });
  };

  if (!wallet) return null;

  const customTokenMints = new Set(customTokens.map((ct) => ct.mintAddress));
  const filteredOnChainTokens = tokens.filter((t) => !customTokenMints.has(t.mint));

  return (
    <div className="min-h-screen flex flex-col p-6 animate-fade-in">
      <div className="w-full max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold">Assets</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchAssets(true)}
              className="p-2 text-gray-400 hover:text-grokie-orange transition-colors"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentPage('add-token')}
              className="flex items-center gap-1 text-sm text-grokie-orange hover:text-grokie-orange-light transition-colors font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Token
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner text="Loading assets..." />
          </div>
        ) : (
          <div className="space-y-3">
            {/* SOL Balance */}
            <div className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TokenIcon
                  logoUrl="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                  symbol="SOL"
                />
                <div>
                  <p className="font-medium">Solana</p>
                  <p className="text-xs text-gray-400">SOL</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">{solBalance === 0 ? '0' : solBalance.toFixed(4)}</p>
                <p className="text-xs text-gray-400">{formatUSD(solBalance * solPrice)}</p>
              </div>
            </div>

            {/* Custom Tokens (added by user) */}
            {customTokens.map((token) => {
              const price = tokenPrices.get(token.mintAddress) || 0;
              const usdValue = token.balance * price;
              return (
                <div key={token.id} className="card flex items-center justify-between group relative">
                  <div className="flex items-center gap-3">
                    <TokenIcon logoUrl={token.logoUrl} symbol={token.symbol} />
                    <div>
                      <p className="font-medium">{token.name}</p>
                      <p className="text-xs text-gray-400">{token.symbol}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{token.balance === 0 ? '0' : token.uiBalance}</p>
                    <p className="text-xs text-gray-400">{formatUSD(usdValue)}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveToken(token.id, token.symbol)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all"
                    title="Remove token"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}

            {/* On-chain SPL Tokens (auto-detected) */}
            {filteredOnChainTokens.map((token) => {
              const price = tokenPrices.get(token.mint) || 0;
              const usdValue = token.balance * price;
              return (
                <div key={token.mint} className="card flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TokenIcon logoUrl={token.logoURI} symbol={token.symbol} />
                    <div>
                      <p className="font-medium">{token.name || token.symbol || 'Unknown Token'}</p>
                      <p className="text-xs text-gray-400">
                        {token.symbol || `${token.mint.slice(0, 6)}...${token.mint.slice(-4)}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{token.uiBalance}</p>
                    <p className="text-xs text-gray-400">{formatUSD(usdValue)}</p>
                  </div>
                </div>
              );
            })}

            {filteredOnChainTokens.length === 0 && customTokens.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm">No SPL tokens found.</p>
                <button
                  onClick={() => setCurrentPage('add-token')}
                  className="mt-3 text-sm text-grokie-orange hover:text-grokie-orange-light font-medium"
                >
                  + Add a token manually
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
