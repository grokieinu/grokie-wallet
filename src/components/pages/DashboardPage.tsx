'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWalletContext } from '@/context/WalletContext';
import { getSOLBalance, getSPLTokenBalances, type TokenBalance } from '@/lib/solana';
import { formatUSD } from '@/lib/price';
import { getMarketData, formatPercentChange, type CoinMarketData } from '@/lib/coingecko';
import { TokenIcon } from '@/components/ui/TokenIcon';
import { Toast } from '@/components/ui/Toast';

type TabType = 'tokens' | 'nfts' | 'activity';

interface TokenDisplayData {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  uiBalance: string;
  price: number;
  change24h: number;
  logoURI?: string;
}

export function DashboardPage() {
  const { wallet, setCurrentPage, rpcEndpoint, lockWallet, setSelectedTokenId } = useWalletContext();
  const [balance, setBalance] = useState<number>(0);
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [tokenDisplayData, setTokenDisplayData] = useState<TokenDisplayData[]>([]);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('tokens');
  const [showBalance, setShowBalance] = useState(true);
  const [marketCoins, setMarketCoins] = useState<CoinMarketData[]>([]);

  const fetchBalance = useCallback(async () => {
    if (!wallet) return;
    setIsLoadingBalance(true);
    try {
      const [bal, splTokens, market] = await Promise.all([
        getSOLBalance(wallet.publicKey, rpcEndpoint).catch(() => 0),
        getSPLTokenBalances(wallet.publicKey, rpcEndpoint).catch(() => []),
        getMarketData().catch(() => []),
      ]);
      setBalance(bal);
      setTokens(splTokens);
      setMarketCoins(market);

      // Fetch price/logo/change for SPL tokens from GeckoTerminal
      const splWithBalance = splTokens.filter((t) => t.balance > 0);
      if (splWithBalance.length > 0) {
        const displayData: TokenDisplayData[] = [];
        for (const token of splWithBalance) {
          let price = 0;
          let change24h = 0;
          let logoURI = token.logoURI;

          try {
            const resp = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${token.mint}`);
            if (resp.ok) {
              const data = await resp.json();
              const attrs = data?.data?.attributes;
              if (attrs) {
                price = parseFloat(attrs.price_usd) || 0;
                change24h = attrs.price_change_percentage?.h24 ? parseFloat(attrs.price_change_percentage.h24) : 0;
                if (attrs.image_url && attrs.image_url !== 'missing.png' && attrs.image_url.startsWith('http')) {
                  logoURI = attrs.image_url;
                }
                if (!token.name && attrs.name) token.name = attrs.name;
                if (!token.symbol && attrs.symbol) token.symbol = attrs.symbol;
              }
            }
          } catch {
            // use defaults
          }

          displayData.push({
            mint: token.mint,
            symbol: token.symbol || token.mint.slice(0, 4),
            name: token.name || 'Unknown Token',
            balance: token.balance,
            uiBalance: token.uiBalance,
            price,
            change24h,
            logoURI,
          });
        }
        setTokenDisplayData(displayData);
      } else {
        setTokenDisplayData([]);
      }
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

  const handleSoon = (feature: string) => {
    setToast({ message: `${feature} - Coming Soon!`, type: 'info' });
  };

  if (!wallet) return null;

  // Calculate total balance using CoinGecko SOL price
  const solMarket = marketCoins.find((c) => c.id === 'solana');
  const solPrice = solMarket?.current_price || 0;
  const usdValue = balance * solPrice;
  const totalTokenValue = tokenDisplayData.reduce((sum, t) => sum + t.balance * t.price, 0);
  const totalUsdValue = usdValue + totalTokenValue;

  // Overall 24h change
  const overallChange = solMarket?.price_change_percentage_24h || 0;
  const overallChangeFormatted = formatPercentChange(overallChange);

  return (
    <div className="min-h-screen flex flex-col animate-fade-in bg-[#050a12]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-4">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="GROKIE" className="w-7 h-7 object-contain" />
          <span className="text-base font-bold tracking-wider text-white">GROKIE WALLET</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleSoon('Notifications')}
            className="p-2 text-yellow-400 hover:text-yellow-300 transition-colors"
            title="Notifications"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          <button
            onClick={lockWallet}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Lock Wallet"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Balance Card */}
      <div className="mx-4 mb-4 rounded-2xl border border-[#1a3a5c] bg-gradient-to-b from-[#0c1929] to-[#0a1220] p-5 pb-6">
        {/* Total Balance Label */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold">TOTAL BALANCE</span>
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>

        {/* Balance Amount */}
        {isLoadingBalance ? (
          <div className="h-16 flex items-center">
            <div className="w-6 h-6 border-2 border-gray-700 border-t-cyan-400 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <h1 className="text-[40px] font-bold text-white leading-tight tracking-tight">
              {showBalance ? formatUSD(totalUsdValue) : '••••••'}
            </h1>
            <div className="flex items-center gap-1 mt-1">
              <span className={`text-sm font-medium ${overallChangeFormatted.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {overallChangeFormatted.isPositive ? '▲' : '▼'} {overallChangeFormatted.text} (24H)
              </span>
            </div>
          </>
        )}

        {/* Action Buttons - Send, Receive, Swap */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <button
            onClick={() => setCurrentPage('send')}
            className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl bg-[#0a1a2e] border border-[#1e4a7a] hover:border-cyan-500 hover:bg-[#0f2240] transition-all"
          >
            <svg className="w-7 h-7 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 11l5-5m0 0l5 5m-5-5v12" />
            </svg>
            <span className="text-xs text-gray-300 font-medium">Send</span>
          </button>

          <button
            onClick={() => setCurrentPage('receive')}
            className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl bg-[#0a1a2e] border border-[#1e4a7a] hover:border-cyan-500 hover:bg-[#0f2240] transition-all"
          >
            <svg className="w-7 h-7 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
            </svg>
            <span className="text-xs text-gray-300 font-medium">Receive</span>
          </button>

          <button
            onClick={() => setCurrentPage('swap')}
            className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl bg-[#0a1a2e] border border-[#1e4a7a] hover:border-cyan-500 hover:bg-[#0f2240] transition-all"
          >
            <svg className="w-7 h-7 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-xs text-gray-300 font-medium">Swap</span>
          </button>
        </div>
      </div>

      {/* Tabs - Tokens / NFTs / Activity */}
      <div className="flex items-center px-5 border-b border-[#1a2a3a]">
        <button
          onClick={() => setActiveTab('tokens')}
          className={`py-3 px-4 text-sm font-medium transition-colors relative ${
            activeTab === 'tokens' ? 'text-cyan-400' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Tokens
          {activeTab === 'tokens' && (
            <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-cyan-400 rounded-full" />
          )}
        </button>
        <button
          onClick={() => handleSoon('NFTs')}
          className="py-3 px-4 text-sm font-medium text-gray-500 hover:text-gray-300 transition-colors"
        >
          NFTs
        </button>
        <button
          onClick={() => setCurrentPage('transactions')}
          className="py-3 px-4 text-sm font-medium text-gray-500 hover:text-gray-300 transition-colors"
        >
          Activity
        </button>
      </div>

      {/* Token List */}
      <div className="flex-1 overflow-y-auto pb-20">
        {/* SOL - only show if balance > 0 */}
        {balance > 0 && solMarket && (
          <div
            onClick={() => { setSelectedTokenId('solana'); setCurrentPage('token-detail'); }}
            className="flex items-center justify-between px-5 py-4 border-b border-[#1a2a3a]/60 cursor-pointer hover:bg-[#0c1929] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[#1a1a2e] flex-shrink-0">
                <img src={solMarket.image} alt="Solana" className="w-10 h-10 object-cover" />
              </div>
              <div>
                <p className="font-semibold text-[15px] text-white">Solana</p>
                <p className="text-xs text-gray-500 mt-0.5">SOL</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-[15px] text-white">{balance.toFixed(4)}</p>
              <div className="flex items-center gap-1.5 justify-end mt-0.5">
                <span className="text-xs text-gray-500">{formatUSD(solMarket.current_price)}</span>
                <span className={`text-xs font-medium ${formatPercentChange(solMarket.price_change_percentage_24h).isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPercentChange(solMarket.price_change_percentage_24h).text}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SPL Tokens - only show tokens with balance > 0 */}
        {tokenDisplayData.map((token) => {
          const change = formatPercentChange(token.change24h);
          return (
            <div
              key={token.mint}
              onClick={() => { setSelectedTokenId(token.mint); setCurrentPage('token-detail'); }}
              className="flex items-center justify-between px-5 py-4 border-b border-[#1a2a3a]/60 cursor-pointer hover:bg-[#0c1929] transition-colors"
            >
              <div className="flex items-center gap-3">
                {token.logoURI ? (
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-[#1a1a2e] flex-shrink-0">
                    <img src={token.logoURI} alt={token.symbol} className="w-10 h-10 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#1a2a3a] flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-gray-400 font-bold">{token.symbol.slice(0, 3)}</span>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-[15px] text-white">{token.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{token.symbol}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-[15px] text-white">{token.uiBalance}</p>
                <div className="flex items-center gap-1.5 justify-end mt-0.5">
                  <span className="text-xs text-gray-500">{formatUSD(token.price)}</span>
                  <span className={`text-xs font-medium ${change.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {change.text}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty state - no tokens owned */}
        {balance === 0 && tokens.filter((t) => t.balance > 0).length === 0 && !isLoadingBalance && (
          <div className="text-center py-16 px-5">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1a2a3a] flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm mb-1">No tokens yet</p>
            <p className="text-gray-600 text-xs mb-4">Your tokens will appear here once you receive them</p>
            <button
              onClick={() => setCurrentPage('receive')}
              className="text-cyan-400 hover:text-cyan-300 text-xs font-medium"
            >
              Receive Tokens
            </button>
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto border-t border-[#1a2a3a] bg-[#050a12] z-50">
        <div className="flex items-center justify-around py-2.5">
          <button
            onClick={() => setCurrentPage('dashboard')}
            className="flex flex-col items-center gap-1"
          >
            <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="text-[10px] text-cyan-400 font-medium">Wallet</span>
          </button>

          <button
            onClick={() => handleSoon('Browser')}
            className="flex flex-col items-center gap-1"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <span className="text-[10px] text-gray-500 font-medium">Browser</span>
          </button>

          <button
            onClick={() => handleSoon('DApps')}
            className="flex flex-col items-center gap-1"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span className="text-[10px] text-gray-500 font-medium">DApps</span>
          </button>

          <button
            onClick={() => setCurrentPage('settings')}
            className="flex flex-col items-center gap-1"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-[10px] text-gray-500 font-medium">Settings</span>
          </button>
        </div>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
