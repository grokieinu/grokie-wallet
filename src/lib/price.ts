/**
 * GROKIE Wallet - Price Service
 * 
 * Fetches token prices in USD from Jupiter Price API.
 * Caches results for 60 seconds to avoid excessive API calls.
 */

const JUPITER_PRICE_API = 'https://api.jup.ag/price/v2';

interface PriceCache {
  price: number;
  timestamp: number;
}

const priceCache = new Map<string, PriceCache>();
const CACHE_DURATION = 60_000; // 60 seconds

/**
 * Fetches the current USD price for SOL.
 */
export async function getSOLPrice(): Promise<number> {
  return getTokenPrice('So11111111111111111111111111111111111111112');
}

/**
 * Fetches USD price for any token by mint address.
 * Uses Jupiter Price API v2.
 */
export async function getTokenPrice(mintAddress: string): Promise<number> {
  // Check cache
  const cached = priceCache.get(mintAddress);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.price;
  }

  try {
    const response = await fetch(`${JUPITER_PRICE_API}?ids=${mintAddress}`);
    if (!response.ok) throw new Error('Price API failed');

    const data = await response.json();
    const priceData = data?.data?.[mintAddress];

    if (priceData && priceData.price) {
      const price = parseFloat(priceData.price);
      priceCache.set(mintAddress, { price, timestamp: Date.now() });
      return price;
    }

    return 0;
  } catch {
    // Fallback: try CoinGecko for SOL
    if (mintAddress === 'So11111111111111111111111111111111111111112') {
      return fetchSOLPriceFromCoinGecko();
    }
    return 0;
  }
}

/**
 * Fetches multiple token prices at once.
 */
export async function getTokenPrices(mintAddresses: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const toFetch: string[] = [];

  // Check cache first
  for (const addr of mintAddresses) {
    const cached = priceCache.get(addr);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      result.set(addr, cached.price);
    } else {
      toFetch.push(addr);
    }
  }

  if (toFetch.length === 0) return result;

  try {
    const ids = toFetch.join(',');
    const response = await fetch(`${JUPITER_PRICE_API}?ids=${ids}`);
    if (!response.ok) throw new Error('Price API failed');

    const data = await response.json();

    for (const addr of toFetch) {
      const priceData = data?.data?.[addr];
      const price = priceData?.price ? parseFloat(priceData.price) : 0;
      priceCache.set(addr, { price, timestamp: Date.now() });
      result.set(addr, price);
    }
  } catch {
    // Set 0 for all failed
    for (const addr of toFetch) {
      result.set(addr, 0);
    }
  }

  return result;
}

/**
 * CoinGecko fallback for SOL price.
 */
async function fetchSOLPriceFromCoinGecko(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    if (!response.ok) return 0;
    const data = await response.json();
    const price = data?.solana?.usd || 0;
    priceCache.set('So11111111111111111111111111111111111111112', { price, timestamp: Date.now() });
    return price;
  } catch {
    return 0;
  }
}

/**
 * Formats a USD value for display.
 */
export function formatUSD(value: number): string {
  if (value === 0) return '$0.00';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.0001) return `$${value.toFixed(6)}`;
  if (value >= 0.00000001) return `$${value.toFixed(10)}`;
  return `$${value.toExponential(4)}`;
}
