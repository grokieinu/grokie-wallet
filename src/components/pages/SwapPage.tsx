'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWalletContext } from '@/context/WalletContext';
import { getSOLBalance, getSPLTokenBalances, type TokenBalance } from '@/lib/solana';
import { getActivePrivateKey } from '@/lib/wallet-manager';
import { getSwapQuote, executeSwap, POPULAR_TOKENS, searchTokens, toRawAmount, fromRawAmount, type JupiterQuote, type JupiterTokenInfo } from '@/lib/jupiter';
import { saveTransaction, type TransactionRecord } from '@/lib/storage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Toast } from '@/components/ui/Toast';

interface SwapToken {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoURI?: string;
  balance: number;
}

export function SwapPage() {
  const { wallet, setCurrentPage, rpcEndpoint } = useWalletContext();
  const [tokens, setTokens] = useState<SwapToken[]>([]);
  const [fromToken, setFromToken] = useState<SwapToken | null>(null);
  const [toToken, setToToken] = useState<SwapToken | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const [slippage, setSlippage] = useState(50); // 0.5% default
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<JupiterTokenInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Load tokens
  const fetchTokens = useCallback(async () => {
    if (!wallet) return;
    setIsLoadingTokens(true);
    try {
      const [solBalance, splTokens] = await Promise.all([
        getSOLBalance(wallet.publicKey, rpcEndpoint).catch(() => 0),
        getSPLTokenBalances(wallet.publicKey, rpcEndpoint).catch(() => []),
      ]);

      const tokenList: SwapToken[] = [];

      // Add popular tokens with balance info
      for (const pt of POPULAR_TOKENS) {
        if (pt.symbol === 'SOL') {
          tokenList.push({ ...pt, balance: solBalance });
        } else {
          const spl = splTokens.find((t) => t.mint === pt.mint);
          tokenList.push({ ...pt, balance: spl?.balance || 0 });
        }
      }

      // Add SPL tokens not in popular list
      for (const spl of splTokens) {
        if (!POPULAR_TOKENS.find((pt) => pt.mint === spl.mint) && spl.balance > 0) {
          tokenList.push({
            symbol: spl.symbol || spl.mint.slice(0, 4),
            name: spl.name || 'Unknown',
            mint: spl.mint,
            decimals: spl.decimals,
            logoURI: spl.logoURI,
            balance: spl.balance,
          });
        }
      }

      setTokens(tokenList);

      // Default: SOL → USDC
      const sol = tokenList.find((t) => t.symbol === 'SOL');
      const usdc = tokenList.find((t) => t.symbol === 'USDC');
      if (sol) setFromToken(sol);
      if (usdc) setToToken(usdc);
    } catch {
      setTokens([]);
    } finally {
      setIsLoadingTokens(false);
    }
  }, [wallet, rpcEndpoint]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // Fetch quote when inputs change
  useEffect(() => {
    const fetchQuote = async () => {
      if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
        setQuote(null);
        setToAmount('');
        return;
      }

      setIsLoadingQuote(true);
      setError('');

      try {
        const rawAmount = toRawAmount(parseFloat(fromAmount), fromToken.decimals);
        const result = await getSwapQuote(fromToken.mint, toToken.mint, rawAmount, slippage);

        if (result) {
          setQuote(result);
          setToAmount(fromRawAmount(result.outAmount, toToken.decimals).toFixed(6));
        } else {
          setQuote(null);
          setToAmount('');
          setError('No route found for this swap.');
        }
      } catch {
        setQuote(null);
        setError('Failed to get quote.');
      } finally {
        setIsLoadingQuote(false);
      }
    };

    const debounce = setTimeout(fetchQuote, 500);
    return () => clearTimeout(debounce);
  }, [fromToken, toToken, fromAmount, slippage]);

  const handleSwap = async () => {
    if (!wallet || !quote || !fromToken || !toToken) return;

    const privateKey = getActivePrivateKey();
    if (!privateKey) {
      setError('Session expired. Please unlock your wallet again.');
      return;
    }

    if (parseFloat(fromAmount) > fromToken.balance) {
      setError(`Insufficient ${fromToken.symbol} balance.`);
      return;
    }

    setIsSwapping(true);
    setError('');

    try {
      const result = await executeSwap(quote, wallet.publicKey, privateKey, rpcEndpoint);

      if (result.success && result.signature) {
        // Save transaction record
        const txRecord: TransactionRecord = {
          id: crypto.randomUUID(),
          walletId: wallet.id,
          signature: result.signature,
          type: 'send',
          amount: parseFloat(fromAmount),
          token: `${fromToken.symbol}→${toToken.symbol}`,
          to: 'Jupiter Swap',
          from: wallet.publicKey,
          timestamp: Date.now(),
          status: 'confirmed',
        };
        await saveTransaction(txRecord);

        setToast({ message: `Swapped ${fromAmount} ${fromToken.symbol} → ${toAmount} ${toToken.symbol}`, type: 'success' });
        setFromAmount('');
        setToAmount('');
        setQuote(null);

        // Refresh balances
        fetchTokens();
      } else {
        setError(result.error || 'Swap failed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed.');
    } finally {
      setIsSwapping(false);
    }
  };

  const handleFlipTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount(toAmount);
    setToAmount('');
    setQuote(null);
  };

  const handleMaxAmount = () => {
    if (!fromToken) return;
    if (fromToken.symbol === 'SOL') {
      setFromAmount(Math.max(0, fromToken.balance - 0.01).toFixed(6));
    } else {
      setFromAmount(fromToken.balance.toString());
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchTokens(trimmed);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const renderTokenPicker = (
    isFrom: boolean,
    onClose: () => void
  ) => {
    const filteredTokens = searchQuery.length >= 2
      ? [] // When searching, show search results instead
      : tokens;

    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center pt-12 animate-fade-in">
        <div className="bg-[#0c1929] border border-[#1a3a5c] w-full max-w-md rounded-2xl p-5 mx-4 flex flex-col" style={{ maxHeight: '75vh' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-base text-white">Select Token</h3>
            <button onClick={() => { onClose(); setSearchQuery(''); setSearchResults([]); }} className="text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search Input */}
          <div className="mb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name, symbol, or paste CA..."
              className="w-full px-4 py-2.5 rounded-xl bg-[#1a2d4a] border border-[#2a4a6a] text-sm text-white placeholder-gray-500 outline-none focus:border-cyan-500/50 transition-colors"
              spellCheck={false}
              autoFocus
            />
          </div>

          {/* Token List */}
          <div className="space-y-1 overflow-y-auto flex-1">
            {isSearching && (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-gray-700 border-t-cyan-400 rounded-full animate-spin" />
              </div>
            )}

            {/* Search Results */}
            {!isSearching && searchQuery.length >= 2 && searchResults.length > 0 && (
              searchResults.map((token) => (
                <button
                  key={token.address}
                  onClick={() => {
                    const swapToken: SwapToken = {
                      symbol: token.symbol,
                      name: token.name,
                      mint: token.address,
                      decimals: token.decimals,
                      logoURI: token.logoURI,
                      balance: 0,
                    };
                    if (isFrom) {
                      setFromToken(swapToken);
                      if (toToken?.mint === token.address) setToToken(null);
                    } else {
                      setToToken(swapToken);
                      if (fromToken?.mint === token.address) setFromToken(null);
                    }
                    setFromAmount('');
                    setToAmount('');
                    setQuote(null);
                    setSearchQuery('');
                    setSearchResults([]);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[#1a2d4a] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-[#1a1a2e] flex items-center justify-center">
                      {token.logoURI ? (
                        <img src={token.logoURI} alt={token.symbol} className="w-8 h-8 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <span className="text-[10px] text-gray-400 font-bold">{token.symbol.slice(0, 3)}</span>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">{token.symbol}</p>
                      <p className="text-xs text-gray-500 max-w-[160px] truncate">{token.name}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-600 max-w-[80px] truncate">{token.address ? `${token.address.slice(0, 4)}...${token.address.slice(-4)}` : ''}</span>
                </button>
              ))
            )}

            {/* No results */}
            {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
              <p className="text-center text-gray-500 text-sm py-6">No tokens found</p>
            )}

            {/* Default token list (when not searching) */}
            {searchQuery.length < 2 && filteredTokens.map((token) => (
              <button
                key={token.mint}
                onClick={() => {
                  if (isFrom) {
                    setFromToken(token);
                    if (toToken?.mint === token.mint) setToToken(null);
                  } else {
                    setToToken(token);
                    if (fromToken?.mint === token.mint) setFromToken(null);
                  }
                  setFromAmount('');
                  setToAmount('');
                  setQuote(null);
                  setSearchQuery('');
                  setSearchResults([]);
                  onClose();
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[#1a2d4a] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-[#1a1a2e] flex items-center justify-center">
                    {token.logoURI ? (
                      <img src={token.logoURI} alt={token.symbol} className="w-8 h-8 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <span className="text-[10px] text-gray-400 font-bold">{token.symbol.slice(0, 3)}</span>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">{token.symbol}</p>
                    <p className="text-xs text-gray-500">{token.name}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {token.balance > 0 ? token.balance.toFixed(4) : '0'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (!wallet) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#050a12] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-4">
        <button
          onClick={() => setCurrentPage('dashboard')}
          className="p-1 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-white">Swap</h1>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-1 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Slippage Settings */}
      {showSettings && (
        <div className="mx-5 mb-4 p-4 rounded-xl bg-[#0c1929] border border-[#1a3a5c]">
          <p className="text-xs text-gray-400 mb-2">Slippage Tolerance</p>
          <div className="flex items-center gap-2">
            {[25, 50, 100, 300].map((bps) => (
              <button
                key={bps}
                onClick={() => setSlippage(bps)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  slippage === bps
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                    : 'bg-[#1a2a3a] text-gray-400 hover:text-white'
                }`}
              >
                {(bps / 100).toFixed(1)}%
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 flex-1">
        {isLoadingTokens ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="lg" text="Loading tokens..." />
          </div>
        ) : (
          <>
            {/* From Token */}
            <div className="rounded-xl bg-[#0c1929] border border-[#1a3a5c] p-4 mb-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">You pay</span>
                {fromToken && (
                  <span className="text-xs text-gray-500">
                    Balance: {fromToken.balance.toFixed(4)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFromPicker(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a2d4a] border border-[#2a4a6a] hover:border-cyan-500/50 transition-all shrink-0"
                >
                  {fromToken?.logoURI ? (
                    <img src={fromToken.logoURI} alt="" className="w-6 h-6 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : fromToken ? (
                    <div className="w-6 h-6 rounded-full bg-[#2a3a5a] flex items-center justify-center">
                      <span className="text-[8px] text-gray-300 font-bold">{fromToken.symbol.slice(0, 2)}</span>
                    </div>
                  ) : null}
                  <span className="text-sm font-medium text-white">{fromToken?.symbol || 'Select'}</span>
                  <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="flex-1 text-right">
                  <input
                    type="number"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-right text-xl font-bold text-white bg-transparent outline-none placeholder-gray-600"
                    step="any"
                    min="0"
                  />
                </div>
                <button
                  onClick={handleMaxAmount}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium px-2 py-1 rounded bg-cyan-500/10"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Flip Button */}
            <div className="flex justify-center -my-1 relative z-10">
              <button
                onClick={handleFlipTokens}
                className="w-9 h-9 rounded-full bg-[#1a2d4a] border-2 border-[#0c1929] flex items-center justify-center hover:bg-[#1e3555] transition-all"
              >
                <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            </div>

            {/* To Token */}
            <div className="rounded-xl bg-[#0c1929] border border-[#1a3a5c] p-4 mt-2 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">You receive</span>
                {toToken && (
                  <span className="text-xs text-gray-500">
                    Balance: {toToken.balance.toFixed(4)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowToPicker(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a2d4a] border border-[#2a4a6a] hover:border-cyan-500/50 transition-all shrink-0"
                >
                  {toToken?.logoURI ? (
                    <img src={toToken.logoURI} alt="" className="w-6 h-6 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : toToken ? (
                    <div className="w-6 h-6 rounded-full bg-[#2a3a5a] flex items-center justify-center">
                      <span className="text-[8px] text-gray-300 font-bold">{toToken.symbol.slice(0, 2)}</span>
                    </div>
                  ) : null}
                  <span className="text-sm font-medium text-white">{toToken?.symbol || 'Select'}</span>
                  <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="flex-1 text-right">
                  {isLoadingQuote ? (
                    <div className="flex justify-end">
                      <div className="w-4 h-4 border-2 border-gray-700 border-t-cyan-400 rounded-full animate-spin" />
                    </div>
                  ) : (
                    <p className="text-xl font-bold text-white">
                      {toAmount || '0.00'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Quote Details */}
            {quote && (
              <div className="rounded-xl bg-[#0c1929] border border-[#1a3a5c] p-4 mb-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Rate</span>
                  <span className="text-gray-300">
                    1 {fromToken?.symbol} ≈ {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(4)} {toToken?.symbol}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Price Impact</span>
                  <span className={`${parseFloat(quote.priceImpactPct) > 1 ? 'text-red-400' : 'text-gray-300'}`}>
                    {parseFloat(quote.priceImpactPct).toFixed(3)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Min Received</span>
                  <span className="text-gray-300">
                    {fromRawAmount(quote.otherAmountThreshold, toToken?.decimals || 6).toFixed(4)} {toToken?.symbol}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Route</span>
                  <span className="text-gray-300">
                    {quote.routePlan.map((r) => r.swapInfo.label).join(' → ')}
                  </span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-sm text-red-400 bg-red-900/20 p-3 rounded-lg mb-4">{error}</p>
            )}

            {/* Swap Button */}
            <button
              onClick={handleSwap}
              disabled={!quote || isSwapping || !fromAmount || parseFloat(fromAmount) <= 0}
              className="w-full py-4 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white"
            >
              {isSwapping ? (
                <LoadingSpinner size="sm" />
              ) : !fromToken || !toToken ? (
                'Select tokens'
              ) : !fromAmount || parseFloat(fromAmount) <= 0 ? (
                'Enter amount'
              ) : isLoadingQuote ? (
                'Getting quote...'
              ) : !quote ? (
                'No route available'
              ) : parseFloat(fromAmount) > (fromToken?.balance || 0) ? (
                `Insufficient ${fromToken?.symbol} balance`
              ) : (
                `Swap ${fromToken?.symbol} → ${toToken?.symbol}`
              )}
            </button>

            {/* Powered by */}
            <p className="text-center text-[10px] text-gray-600 mt-3">
              Powered by Jupiter Aggregator
            </p>
          </>
        )}
      </div>

      {/* Token Pickers */}
      {showFromPicker && renderTokenPicker(true, () => setShowFromPicker(false))}
      {showToPicker && renderTokenPicker(false, () => setShowToPicker(false))}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
