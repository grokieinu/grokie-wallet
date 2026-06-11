/**
 * GROKIE Wallet - CoinGecko Price Service
 * 
 * Fetches token prices, 24h change, and icon URLs from CoinGecko API.
 * Caches results for 60 seconds.
 */

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

export interface CoinMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap?: number;
  total_volume?: number;
  circulating_supply?: number;
  total_supply?: number;
}

export interface CoinDetailData {
  id: string;
  symbol: string;
  name: string;
  image: { large: string; small: string; thumb: string };
  market_data: {
    current_price: { usd: number };
    price_change_percentage_24h: number;
    market_cap: { usd: number };
    total_volume: { usd: number };
    circulating_supply: number;
    total_supply: number | null;
    max_supply: number | null;
  };
  description: { en: string };
  links: {
    homepage: string[];
    blockchain_site: string[];
    twitter_screen_name: string;
  };
  genesis_date: string | null;
}

export interface ChartData {
  prices: [number, number][];
}

interface MarketCache {
  data: CoinMarketData[];
  timestamp: number;
}

let marketCache: MarketCache | null = null;
const CACHE_DURATION = 60_000; // 60 seconds

/**
 * Default coins to always show on dashboard.
 * CoinGecko IDs for: Solana, Ethereum, Grokie Inu, USD Coin, Bitcoin
 */
const DEFAULT_COIN_IDS = ['solana', 'ethereum', 'grok-inu', 'usd-coin', 'bitcoin'];

/**
 * Fetches market data for default coins from CoinGecko.
 */
export async function getMarketData(extraIds: string[] = []): Promise<CoinMarketData[]> {
  if (marketCache && Date.now() - marketCache.timestamp < CACHE_DURATION) {
    return marketCache.data;
  }

  const allIds = [...DEFAULT_COIN_IDS, ...extraIds].join(',');

  try {
    const response = await fetch(
      `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${allIds}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data: CoinMarketData[] = await response.json();
    marketCache = { data, timestamp: Date.now() };
    return data;
  } catch {
    if (marketCache) {
      return marketCache.data;
    }
    return [];
  }
}

/**
 * Fetches detailed coin info from CoinGecko.
 */
export async function getCoinDetail(coinId: string): Promise<CoinDetailData | null> {
  try {
    const response = await fetch(
      `${COINGECKO_API}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Fetches price chart data for a coin.
 * @param days - Number of days (fractional supported: 0.04 ≈ 1 hour, 0.08 ≈ 2 hours, 1, 7, 30, 90, 365)
 * CoinGecko auto-adjusts granularity: <1 day = 5-min intervals, 1-90 days = hourly, >90 days = daily
 */
export async function getCoinChart(coinId: string, days: number = 7): Promise<ChartData | null> {
  try {
    const response = await fetch(
      `${COINGECKO_API}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Format percentage change with + or - sign.
 */
export function formatPercentChange(change: number | null | undefined): { text: string; isPositive: boolean } {
  if (change === null || change === undefined) {
    return { text: '0.00%', isPositive: true };
  }
  const isPositive = change >= 0;
  const formatted = `${isPositive ? '+' : ''}${change.toFixed(2)}%`;
  return { text: formatted, isPositive };
}

/**
 * Format large numbers to K, M, B.
 */
export function formatLargeNumber(value: number | null | undefined): string {
  if (!value) return '-';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}
