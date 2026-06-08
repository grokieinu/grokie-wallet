'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWalletContext } from '@/context/WalletContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { TokenIcon } from '@/components/ui/TokenIcon';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { Toast } from '@/components/ui/Toast';
import { getSOLBalance, getSPLTokenBalances, getExplorerUrl } from '@/lib/solana';
import { getActivePrivateKey } from '@/lib/wallet-manager';
import { getSwapQuote, executeSwap, toRawAmount, fromRawAmount, SOL_MINT, type SwapQuote } from '@/lib/swap';
import { searchTokens, type TokenMetadata } from '@/lib/token-list';

interface TokenOption {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  logoURI?: string | null;
}

export function SwapPage() {
  const { wallet, setCurrentPage, rpcEndpoint } = useWalletContext();

  const [fromToken, setFromToken] = useState<TokenOption | null>(null);
  const [toToken, setToToken] = useState<TokenOption | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [slippage, setSlippage] = useState(0.5);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState('');
  const [txSignature, setTxSignature] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Token picker
  const [showPicker, setShowPicker] = useState<'from' | 'to' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TokenMetadata[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [availableTokens, setAvailableTokens] = useState<TokenOption[]>([]);

  // Load tokens
  useEffect(() => {
    const load = async () => {
      if (!wallet) return;
      try {
        const { getCustomTokens } = await import('@/lib/storage');
        const [solBal, splTokens, customTokens] = await Promise.all([
          getSOLBalance(wallet.publicKey, rpcEndpoint).catch(() => 0),
          getSPLTokenBalances(wallet.publicKey, rpcEndpoint).catch(() => []),
          getCustomTokens(wallet.id).catch(() => []),
        ]);

        const tokens: TokenOption[] = [
          { mint: SOL_MINT, symbol: 'SOL', name: 'Solana', decimals: 9, balance: solBal, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' },
          ...splTokens.map((t) => ({
            mint: t.mint, symbol: t.symbol || 'Unknown', name: t.name || 'Unknown',
            decimals: t.decimals, balance: t.balance, logoURI: t.logoURI,
          })),
        ];

        const existingMints = new Set(tokens.map((t) => t.mint));
        for (const ct of customTokens) {
          if (!existingMints.has(ct.mintAddress)) {
            tokens.push({ mint: ct.mintAddress, symbol: ct.symbol, name: ct.name, decimals: ct.decimals, balance: 0, logoURI: ct.logoUrl });
          }
        }

        setAvailableTokens(tokens);
        if (!fromToken) setFromToken(tokens[0]);
      } catch { /* ignore */ }
    };
    load();
  }, [wallet, rpcEndpoint]);

  // Fetch quote
  const fetchQuote = useCallback(async () => {
    if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
      setQuote(null);
      return;
    }

    setIsLoadingQuote(true);
    setError('');

    try {
      const rawAmount = toRawAmount(parseFloat(fromAmount), fromToken.decimals);
      const result = await getSwapQuote(fromToken.mint, toToken.mint, rawAmount, Math.round(slippage * 100));

      if (result) {
        setQuote(result);
      } else {
        setError(`No route found for ${fromToken.symbol} → ${toToken.symbol}. Try a different pair or check if the network is congested.`);
        setQuote(null);
      }
    } catch {
      setError('Failed to get quote. Network may be congested.');
      setQuote(null);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [fromToken, toToken, fromAmount, slippage]);

  useEffect(() => {
    const timer = setTimeout(fetchQuote, 600);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  // Search
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const results = await searchTokens(query, 10);
      setSearchResults(results);
    } catch { setSearchResults([]); }
    finally { setIsSearching(false); }
  };

  const handleFlip = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount('');
    setQuote(null);
  };

  const handleSelectToken = (token: TokenMetadata | TokenOption) => {
    const option: TokenOption = 'mint' in token
      ? token as TokenOption
      : { mint: token.address, symbol: token.symbol, name: token.name, decimals: token.decimals, balance: 0, logoURI: token.logoURI };

    if (showPicker === 'from') setFromToken(option);
    else setToToken(option);
    setShowPicker(null);
    setSearchQuery('');
    setSearchResults([]);
    setQuote(null);
  };

  const handleSwap = async () => {
    if (!wallet || !quote || !fromToken || !toToken) return;

    const privateKey = getActivePrivateKey();
    if (!privateKey) { setError('Session expired. Please unlock your wallet.'); return; }

    setIsSwapping(true);
    setError('');

    try {
      const result = await executeSwap(quote, wallet.publicKey, privateKey, rpcEndpoint);
      if (result.success && result.signature) {
        setTxSignature(result.signature);
        setShowResult(true);
      } else {
        setError(result.error || 'Swap failed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed.');
    } finally {
      setIsSwapping(false);
    }
  };

  const outputAmount = quote ? fromRawAmount(quote.outAmount, toToken?.decimals || 9) : 0;
  const priceImpact = quote ? parseFloat(quote.priceImpactPct) : 0;

  if (!wallet) return null;

  // Token picker
  if (showPicker) {
    return (
      <div className="min-h-screen flex flex-col p-6 animate-fade-in">
        <div className="w-full max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => { setShowPicker(null); setSearchQuery(''); setSearchResults([]); }} className="text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold">Select Token</h1>
          </div>
          <input type="text" value={searchQuery} onChange={(e) => handleSearch(e.target.value)} className="input-field mb-4" placeholder="Search token name or paste address..." autoFocus />
          {isSearching && <div className="flex justify-center py-4"><LoadingSpinner size="sm" /></div>}
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {searchQuery.length < 2 && availableTokens.map((t) => (
              <button key={t.mint} onClick={() => handleSelectToken(t)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-grokie-mid-gray transition-colors">
                <TokenIcon logoUrl={t.logoURI} symbol={t.symbol} size="sm" />
                <div className="text-left flex-1">
                  <p className="text-sm font-medium">{t.symbol}</p>
                  <p className="text-xs text-gray-500">{t.name}</p>
                </div>
                <p className="text-sm text-gray-400">{t.balance > 0 ? t.balance.toFixed(4) : '0'}</p>
              </button>
            ))}
            {searchResults.map((t) => (
              <button key={t.address} onClick={() => handleSelectToken(t)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-grokie-mid-gray transition-colors">
                <TokenIcon logoUrl={t.logoURI} symbol={t.symbol} size="sm" />
                <div className="text-left flex-1">
                  <p className="text-sm font-medium">{t.symbol}</p>
                  <p className="text-xs text-gray-500">{t.name}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Result
  if (showResult) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-fade-in">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Swap Successful!</h2>
          <p className="text-gray-400 text-sm mb-6">{fromAmount} {fromToken?.symbol} → {outputAmount.toFixed(4)} {toToken?.symbol}</p>
          <a href={getExplorerUrl(txSignature)} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full inline-flex items-center justify-center gap-2 mb-3">
            View on Explorer ↗
          </a>
          <button onClick={() => { setShowResult(false); setFromAmount(''); setQuote(null); }} className="btn-primary w-full">Swap Again</button>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="min-h-screen flex flex-col p-6 animate-fade-in">
      <div className="w-full max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setCurrentPage('dashboard')} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">GROKIE Swap</h1>
        </div>

        {/* From */}
        <div className="card mb-2">
          <div className="flex justify-between mb-2">
            <span className="text-xs text-gray-400">You pay</span>
            {fromToken && <span className="text-xs text-gray-500">Balance: {fromToken.balance > 0 ? fromToken.balance.toFixed(4) : '0'}</span>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowPicker('from')} className="flex items-center gap-2 bg-grokie-mid-gray hover:bg-grokie-light-gray px-3 py-2 rounded-xl shrink-0">
              {fromToken ? <><TokenIcon logoUrl={fromToken.logoURI} symbol={fromToken.symbol} size="sm" /><span className="font-medium text-sm">{fromToken.symbol}</span></> : <span className="text-sm text-gray-400">Select</span>}
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            <input type="number" value={fromAmount} onChange={(e) => setFromAmount(e.target.value)} className="flex-1 bg-transparent text-right text-xl font-semibold outline-none placeholder-gray-600" placeholder="0" />
          </div>
          {fromToken && fromToken.balance > 0 && (
            <button onClick={() => setFromAmount(fromToken.balance.toString())} className="mt-2 text-xs text-grokie-orange">MAX</button>
          )}
        </div>

        {/* Flip */}
        <div className="flex justify-center -my-3 relative z-10">
          <button onClick={handleFlip} className="w-10 h-10 rounded-full bg-grokie-mid-gray border-4 border-grokie-black flex items-center justify-center hover:bg-grokie-light-gray">
            <svg className="w-4 h-4 text-grokie-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
          </button>
        </div>

        {/* To */}
        <div className="card mt-2 mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-xs text-gray-400">You receive</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowPicker('to')} className="flex items-center gap-2 bg-grokie-mid-gray hover:bg-grokie-light-gray px-3 py-2 rounded-xl shrink-0">
              {toToken ? <><TokenIcon logoUrl={toToken.logoURI} symbol={toToken.symbol} size="sm" /><span className="font-medium text-sm">{toToken.symbol}</span></> : <span className="text-sm text-gray-400">Select token</span>}
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            <div className="flex-1 text-right">
              {isLoadingQuote ? <LoadingSpinner size="sm" /> : <p className="text-xl font-semibold">{outputAmount > 0 ? outputAmount.toFixed(6) : '0'}</p>}
            </div>
          </div>
        </div>

        {/* Slippage */}
        <div className="flex items-center justify-between mb-4 px-1">
          <span className="text-xs text-gray-400">Slippage</span>
          <div className="flex gap-1">
            {[0.5, 1.0, 3.0].map((s) => (
              <button key={s} onClick={() => setSlippage(s)} className={`px-2 py-1 rounded-lg text-xs font-medium ${slippage === s ? 'bg-grokie-orange text-white' : 'bg-grokie-mid-gray text-gray-400'}`}>{s}%</button>
            ))}
          </div>
        </div>

        {/* Quote info */}
        {quote && toToken && fromToken && (
          <div className="card mb-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Rate</span>
              <span>1 {fromToken.symbol} ≈ {(outputAmount / parseFloat(fromAmount || '1')).toFixed(4)} {toToken.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Price Impact</span>
              <span className={priceImpact > 1 ? 'text-red-400' : 'text-green-400'}>{priceImpact.toFixed(2)}%</span>
            </div>
          </div>
        )}

        {priceImpact > 3 && quote && (
          <WarningBanner type="danger" title="Very High Price Impact" message={`${priceImpact.toFixed(1)}% impact. You may lose significant value.`} />
        )}

        {error && <p className="text-sm text-red-400 bg-red-900/20 p-3 rounded-lg mb-4">{error}</p>}

        {/* Swap button */}
        <button onClick={handleSwap} disabled={!quote || isSwapping} className="btn-primary w-full text-lg py-4">
          {isSwapping ? <LoadingSpinner size="sm" /> : !fromToken || !toToken ? 'Select tokens' : !fromAmount || parseFloat(fromAmount) <= 0 ? 'Enter amount' : !quote && isLoadingQuote ? 'Getting quote...' : !quote ? 'No route available' : `Swap ${fromToken.symbol} → ${toToken.symbol}`}
        </button>

        <p className="text-xs text-gray-500 text-center mt-3">Powered by GROKIE Swap via Jupiter</p>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
