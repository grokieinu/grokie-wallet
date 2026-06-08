/**
 * GROKIE Wallet - Token List Service
 * 
 * Fetches token metadata using multiple sources for maximum coverage:
 * 1. Jupiter Token API (verified tokens)
 * 2. DexScreener API (supports ALL tokens including newest memecoins & Token-2022)
 * 3. Solana FM API (additional coverage)
 * 
 * Caches results in memory to avoid repeated API calls.
 */

export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string | null;
}

// In-memory caches
let bulkCache: Map<string, TokenMetadata> | null = null;
let bulkCacheTimestamp: number = 0;
const singleTokenCache = new Map<string, TokenMetadata>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Looks up a single token by mint address.
 * Tries multiple APIs in order of reliability:
 * 1. Jupiter Token API
 * 2. DexScreener (has newest tokens, memecoins, Token-2022)
 * 3. Solana FM
 */
export async function getTokenMetadata(mintAddress: string): Promise<TokenMetadata | null> {
  // Check cache first
  const cached = singleTokenCache.get(mintAddress);
  if (cached) return cached;

  if (bulkCache) {
    const fromBulk = bulkCache.get(mintAddress);
    if (fromBulk) return fromBulk;
  }

  // 1. Try Jupiter per-token API
  const jupResult = await fetchFromJupiter(mintAddress);
  if (jupResult) {
    singleTokenCache.set(mintAddress, jupResult);
    return jupResult;
  }

  // 2. Try DexScreener API (has almost ALL Solana tokens)
  const dexResult = await fetchFromDexScreener(mintAddress);
  if (dexResult) {
    singleTokenCache.set(mintAddress, dexResult);
    return dexResult;
  }

  // 3. Try Solana FM
  const sfmResult = await fetchFromSolanaFM(mintAddress);
  if (sfmResult) {
    singleTokenCache.set(mintAddress, sfmResult);
    return sfmResult;
  }

  return null;
}

/**
 * Jupiter per-token lookup
 */
async function fetchFromJupiter(mintAddress: string): Promise<TokenMetadata | null> {
  try {
    const response = await fetch(`https://tokens.jup.ag/token/${mintAddress}`);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data || !data.address) return null;

    return {
      address: data.address,
      symbol: data.symbol || 'UNKNOWN',
      name: data.name || 'Unknown Token',
      decimals: data.decimals ?? 9,
      logoURI: data.logoURI || data.logo_uri || null,
    };
  } catch {
    return null;
  }
}

/**
 * DexScreener API lookup — supports virtually ALL Solana tokens
 * including newest memecoins and Token-2022 tokens.
 */
async function fetchFromDexScreener(mintAddress: string): Promise<TokenMetadata | null> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data?.pairs || data.pairs.length === 0) return null;

    // Find the pair where our token is baseToken or quoteToken
    const pair = data.pairs[0];
    const tokenInfo = pair.baseToken.address.toLowerCase() === mintAddress.toLowerCase()
      ? pair.baseToken
      : pair.quoteToken;

    return {
      address: mintAddress,
      symbol: tokenInfo.symbol || 'UNKNOWN',
      name: tokenInfo.name || 'Unknown Token',
      decimals: 9, // DexScreener doesn't always return decimals, default to 9
      logoURI: pair.info?.imageUrl || null,
    };
  } catch {
    return null;
  }
}

/**
 * Solana FM API lookup — another comprehensive token registry
 */
async function fetchFromSolanaFM(mintAddress: string): Promise<TokenMetadata | null> {
  try {
    const response = await fetch(`https://api.solana.fm/v1/tokens/${mintAddress}`);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data || !data.tokenHash) return null;

    return {
      address: mintAddress,
      symbol: data.symbol || data.tokenName?.slice(0, 8) || 'UNKNOWN',
      name: data.tokenName || 'Unknown Token',
      decimals: data.decimals ?? 9,
      logoURI: data.logoURI || data.logo || null,
    };
  } catch {
    return null;
  }
}

/**
 * Fetches the verified token list for bulk operations (enriching balances).
 */
async function fetchBulkTokenList(): Promise<Map<string, TokenMetadata>> {
  if (bulkCache && Date.now() - bulkCacheTimestamp < CACHE_DURATION) {
    return bulkCache;
  }

  try {
    const response = await fetch('https://tokens.jup.ag/tokens?tags=verified');
    if (!response.ok) throw new Error('Failed to fetch');

    const tokens: Array<{
      address: string;
      symbol: string;
      name: string;
      decimals: number;
      logoURI?: string;
    }> = await response.json();

    const map = new Map<string, TokenMetadata>();
    for (const token of tokens) {
      map.set(token.address, {
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logoURI: token.logoURI || null,
      });
    }

    bulkCache = map;
    bulkCacheTimestamp = Date.now();
    return map;
  } catch {
    return bulkCache || new Map();
  }
}

/**
 * Gets metadata for multiple tokens at once.
 * Uses bulk list first, then individual lookups for missing tokens.
 */
export async function getTokensMetadata(mintAddresses: string[]): Promise<Map<string, TokenMetadata>> {
  const list = await fetchBulkTokenList();
  const result = new Map<string, TokenMetadata>();
  const missing: string[] = [];

  for (const addr of mintAddresses) {
    const meta = list.get(addr) || singleTokenCache.get(addr);
    if (meta) {
      result.set(addr, meta);
    } else {
      missing.push(addr);
    }
  }

  // Fetch missing tokens individually (parallel, max 5 at once)
  if (missing.length > 0) {
    const batchSize = 5;
    for (let i = 0; i < missing.length; i += batchSize) {
      const batch = missing.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((addr) => getTokenMetadata(addr))
      );
      for (let j = 0; j < results.length; j++) {
        const res = results[j];
        if (res.status === 'fulfilled' && res.value) {
          result.set(batch[j], res.value);
        }
      }
    }
  }

  return result;
}

/**
 * Searches tokens by name or symbol using DexScreener search API.
 * This supports searching ALL tokens on Solana.
 */
export async function searchTokens(query: string, limit: number = 20): Promise<TokenMetadata[]> {
  if (!query || query.length < 2) return [];

  const results: TokenMetadata[] = [];

  // Search from bulk cache first
  const list = await fetchBulkTokenList();
  const q = query.toLowerCase();

  for (const token of list.values()) {
    if (
      token.symbol.toLowerCase().includes(q) ||
      token.name.toLowerCase().includes(q) ||
      token.address.toLowerCase() === q
    ) {
      results.push(token);
      if (results.length >= limit) return results;
    }
  }

  // Also search DexScreener for tokens not in Jupiter list
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`);
    if (response.ok) {
      const data = await response.json();
      if (data?.pairs) {
        const seen = new Set(results.map((r) => r.address));
        for (const pair of data.pairs) {
          if (pair.chainId !== 'solana') continue;
          
          const tokenInfo = pair.baseToken;
          if (!seen.has(tokenInfo.address)) {
            results.push({
              address: tokenInfo.address,
              symbol: tokenInfo.symbol || 'UNKNOWN',
              name: tokenInfo.name || 'Unknown',
              decimals: 9,
              logoURI: pair.info?.imageUrl || null,
            });
            seen.add(tokenInfo.address);
            if (results.length >= limit) break;
          }
        }
      }
    }
  } catch {
    // DexScreener search failed, return what we have
  }

  return results;
}
