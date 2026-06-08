'use client';

import { useState, useCallback } from 'react';
import { useWalletContext } from '@/context/WalletContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { Toast } from '@/components/ui/Toast';
import { isValidSolanaAddress, getTokenMintInfo } from '@/lib/solana';
import { saveCustomToken, getCustomToken, type CustomTokenRecord } from '@/lib/storage';
import { searchTokens, getTokenMetadata, type TokenMetadata } from '@/lib/token-list';

export function AddTokenPage() {
  const { wallet, setCurrentPage, rpcEndpoint } = useWalletContext();
  const [mintAddress, setMintAddress] = useState('');
  const [symbol, setSymbol] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [decimals, setDecimals] = useState<number | null>(null);
  const [logoURI, setLogoURI] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [validated, setValidated] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TokenMetadata[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(true);

  // Debounced search
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchTokens(query, 15);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Select token from search results
  const handleSelectToken = (token: TokenMetadata) => {
    setMintAddress(token.address);
    setSymbol(token.symbol);
    setTokenName(token.name);
    setDecimals(token.decimals);
    setLogoURI(token.logoURI);
    setValidated(true);
    setManualMode(false);
    setError('');
    setShowSearch(false);
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleValidate = async () => {
    setError('');
    setValidated(false);
    setManualMode(false);

    if (!mintAddress.trim()) {
      setError('Please enter a token mint address.');
      return;
    }

    if (!isValidSolanaAddress(mintAddress.trim())) {
      setError('Invalid Solana address format.');
      return;
    }

    // Check if already added
    if (wallet) {
      const existing = await getCustomToken(mintAddress.trim());
      if (existing && existing.walletId === wallet.id) {
        setError('This token is already in your list.');
        return;
      }
    }

    setIsValidating(true);
    try {
      // Try multi-source lookup (Jupiter + DexScreener + SolanaFM)
      const meta = await getTokenMetadata(mintAddress.trim());

      if (meta) {
        setDecimals(meta.decimals);
        if (!symbol) setSymbol(meta.symbol);
        if (!tokenName) setTokenName(meta.name);
        setLogoURI(meta.logoURI);
        setValidated(true);
        return;
      }

      // Try RPC on-chain lookup as last resort
      const info = await getTokenMintInfo(mintAddress.trim(), rpcEndpoint);
      if (info) {
        setDecimals(info.decimals);
        setValidated(true);
        return;
      }

      // Nothing found — allow manual mode
      setManualMode(true);
      setDecimals(9);
      setError('Token not found in any registry. You can still add it manually below.');
    } catch (err) {
      setManualMode(true);
      setDecimals(9);
      setError('Network error: ' + (err instanceof Error ? err.message : 'unavailable') + '. You can add the token manually.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleAddToken = async () => {
    if (!wallet || (!validated && !manualMode) || decimals === null) return;

    if (!symbol.trim()) {
      setError('Please enter a token symbol (e.g., USDC, BONK).');
      return;
    }

    setIsAdding(true);
    setError('');

    try {
      const tokenRecord: CustomTokenRecord = {
        id: mintAddress.trim(),
        walletId: wallet.id,
        mintAddress: mintAddress.trim(),
        symbol: symbol.trim().toUpperCase(),
        name: tokenName.trim() || symbol.trim().toUpperCase(),
        decimals,
        logoUrl: logoURI || undefined,
        addedAt: Date.now(),
      };

      await saveCustomToken(tokenRecord);
      setToast({ message: `${symbol.toUpperCase()} added successfully!`, type: 'success' });

      setTimeout(() => {
        setCurrentPage('assets');
      }, 1200);
    } catch (err) {
      setError('Failed to save token: ' + (err instanceof Error ? err.message : 'Unknown error. Try clearing browser data and reloading.'));
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-6 animate-fade-in">
      <div className="w-full max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setCurrentPage('assets')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">Add Token</h1>
        </div>

        {/* Search Section */}
        {showSearch && (
          <div className="mb-6">
            <label className="input-label">Search Token (by name, symbol, or CA)</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="input-field"
              placeholder="Search: BONK, Jupiter, USDC, or paste CA..."
              spellCheck={false}
            />

            {/* Search Results */}
            {isSearching && (
              <div className="mt-3 flex justify-center">
                <LoadingSpinner size="sm" text="Searching..." />
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="mt-3 max-h-80 overflow-y-auto space-y-1 rounded-xl border border-grokie-light-gray">
                {searchResults.map((token) => (
                  <button
                    key={token.address}
                    onClick={() => handleSelectToken(token)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-grokie-mid-gray transition-colors first:rounded-t-xl last:rounded-b-xl"
                  >
                    {token.logoURI ? (
                      <img
                        src={token.logoURI}
                        alt={token.symbol}
                        className="w-8 h-8 rounded-full bg-grokie-mid-gray"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '';
                          (e.target as HTMLImageElement).className = 'hidden';
                        }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-grokie-mid-gray flex items-center justify-center">
                        <span className="text-xs font-bold text-grokie-orange">{token.symbol.slice(0, 2)}</span>
                      </div>
                    )}
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{token.name}</p>
                      <p className="text-xs text-gray-500">{token.symbol}</p>
                    </div>
                    <p className="text-xs text-gray-500 font-mono">
                      {token.address.slice(0, 4)}...{token.address.slice(-4)}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
              <p className="mt-3 text-sm text-gray-500 text-center">No tokens found for &ldquo;{searchQuery}&rdquo;</p>
            )}

            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 h-px bg-grokie-light-gray" />
              <span className="text-xs text-gray-500">or paste contract address</span>
              <div className="flex-1 h-px bg-grokie-light-gray" />
            </div>
          </div>
        )}

        {/* Manual CA Input */}
        <div className="space-y-4">
          <div>
            <label className="input-label">Token Mint Address (CA)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={mintAddress}
                onChange={(e) => {
                  setMintAddress(e.target.value);
                  setValidated(false);
                  setManualMode(false);
                  setError('');
                  setShowSearch(false);
                }}
                className="input-field flex-1 font-mono text-sm"
                placeholder="Paste token contract address..."
                spellCheck={false}
              />
              <button
                onClick={handleValidate}
                disabled={isValidating || !mintAddress.trim()}
                className="btn-secondary px-4 text-sm whitespace-nowrap"
              >
                {isValidating ? <LoadingSpinner size="sm" /> : 'Verify'}
              </button>
            </div>
          </div>

          {/* Validation success */}
          {validated && (
            <div className="bg-green-900/20 border border-green-600/50 rounded-xl p-3 flex items-center gap-3">
              {logoURI && (
                <img src={logoURI} alt={symbol} className="w-8 h-8 rounded-full" />
              )}
              <div className="flex-1">
                <p className="text-sm text-green-300 font-medium">
                  {tokenName || symbol} ({symbol})
                </p>
                <p className="text-xs text-green-400">{decimals} decimals</p>
              </div>
              <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}

          {/* Error / warning */}
          {error && (
            <p className={`text-sm p-3 rounded-lg ${manualMode ? 'text-yellow-300 bg-yellow-900/20' : 'text-red-400 bg-red-900/20'}`}>
              {error}
            </p>
          )}

          {/* Token details form (shown after validation OR in manual mode) */}
          {(validated || manualMode) && (
            <>
              <div>
                <label className="input-label">Token Symbol *</label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="input-field"
                  placeholder="e.g., USDC, BONK, WIF"
                  maxLength={10}
                />
              </div>

              <div>
                <label className="input-label">Token Name (optional)</label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  className="input-field"
                  placeholder="e.g., USD Coin, Bonk Inu"
                  maxLength={40}
                />
              </div>

              {manualMode && (
                <div>
                  <label className="input-label">Decimals</label>
                  <input
                    type="number"
                    value={decimals ?? 9}
                    onChange={(e) => setDecimals(parseInt(e.target.value) || 0)}
                    className="input-field"
                    min={0}
                    max={18}
                  />
                  <p className="text-xs text-gray-500 mt-1">Most Solana tokens use 6 or 9 decimals.</p>
                </div>
              )}

              <button
                onClick={handleAddToken}
                disabled={isAdding || !symbol.trim()}
                className="btn-primary w-full"
              >
                {isAdding ? <LoadingSpinner size="sm" /> : `Add ${symbol.toUpperCase() || 'Token'}`}
              </button>
            </>
          )}
        </div>

        {/* Popular tokens (shown when nothing is selected) */}
        {!validated && !manualMode && showSearch && searchResults.length === 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Popular Tokens</h3>
            <div className="space-y-2">
              {POPULAR_TOKENS.map((token) => (
                <button
                  key={token.mint}
                  onClick={() => {
                    setMintAddress(token.mint);
                    setSymbol(token.symbol);
                    setTokenName(token.name);
                    setDecimals(token.decimals);
                    setLogoURI(token.logoURI || null);
                    setValidated(true);
                    setManualMode(false);
                    setError('');
                    setShowSearch(false);
                  }}
                  className="w-full card flex items-center justify-between py-3 hover:border-grokie-orange/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {token.logoURI ? (
                      <img src={token.logoURI} alt={token.symbol} className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-grokie-mid-gray flex items-center justify-center">
                        <span className="text-xs font-bold text-grokie-orange">{token.symbol.slice(0, 2)}</span>
                      </div>
                    )}
                    <div className="text-left">
                      <p className="text-sm font-medium">{token.name}</p>
                      <p className="text-xs text-gray-500">{token.symbol}</p>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// Well-known Solana SPL tokens
const POPULAR_TOKENS = [
  { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', name: 'USD Coin', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png' },
  { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT', name: 'Tether USD', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg' },
  { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', name: 'Bonk', decimals: 5, logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I' },
  { mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', symbol: 'WIF', name: 'dogwifhat', decimals: 6, logoURI: 'https://bafkreibk3covs5ltyqxa272uodhber6pbfwfkdezjcai3fcjdz3uf3iq.ipfs.nftstorage.link' },
  { mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', symbol: 'JUP', name: 'Jupiter', decimals: 6, logoURI: 'https://static.jup.ag/jup/icon.png' },
  { mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', symbol: 'mSOL', name: 'Marinade Staked SOL', decimals: 9, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png' },
  { mint: 'So11111111111111111111111111111111111111112', symbol: 'wSOL', name: 'Wrapped SOL', decimals: 9, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' },
  { mint: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof', symbol: 'RENDER', name: 'Render Token', decimals: 8, logoURI: null },
];
