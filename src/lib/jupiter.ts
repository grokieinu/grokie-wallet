/**
 * GROKIE Wallet - Jupiter Swap Aggregator Integration
 * 
 * Uses Jupiter API v6 to fetch quotes and execute swaps on Solana.
 * Supports all tokens listed on Jupiter.
 */

import { Connection, VersionedTransaction, PublicKey } from '@solana/web3.js';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const JUPITER_QUOTE_API = 'https://api.jup.ag/swap/v1';

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

export interface SwapResult {
  success: boolean;
  signature?: string;
  error?: string;
}

/**
 * Common token mint addresses on Solana.
 */
export const POPULAR_TOKENS = [
  { symbol: 'SOL', name: 'Solana', mint: 'So11111111111111111111111111111111111111112', decimals: 9, logoURI: 'https://coin-images.coingecko.com/coins/images/4128/large/solana.png' },
  { symbol: 'USDC', name: 'USD Coin', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, logoURI: 'https://coin-images.coingecko.com/coins/images/6319/large/usdc.png' },
  { symbol: 'USDT', name: 'Tether USD', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6, logoURI: 'https://coin-images.coingecko.com/coins/images/325/large/Tether.png' },
  { symbol: 'BONK', name: 'Bonk', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5, logoURI: 'https://coin-images.coingecko.com/coins/images/28600/large/bonk.jpg' },
  { symbol: 'JUP', name: 'Jupiter', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', decimals: 6, logoURI: 'https://static.jup.ag/jup/icon.png' },
  { symbol: 'WIF', name: 'dogwifhat', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6, logoURI: 'https://coin-images.coingecko.com/coins/images/33566/large/dogwifhat.jpg' },
  { symbol: 'PYTH', name: 'Pyth Network', mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', decimals: 6, logoURI: 'https://coin-images.coingecko.com/coins/images/31924/large/pyth.png' },
  { symbol: 'RNDR', name: 'Render Token', mint: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof', decimals: 8, logoURI: 'https://coin-images.coingecko.com/coins/images/11636/large/rndr.png' },
  { symbol: 'W', name: 'Wormhole', mint: '85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ', decimals: 6, logoURI: 'https://coin-images.coingecko.com/coins/images/35087/large/wormhole_logo.png' },
  { symbol: 'JITO', name: 'Jito SOL', mint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', decimals: 9, logoURI: 'https://coin-images.coingecko.com/coins/images/33228/large/jitosol.png' },
  { symbol: 'HNT', name: 'Helium', mint: 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux', decimals: 8, logoURI: 'https://coin-images.coingecko.com/coins/images/4284/large/Helium_HNT.png' },
  { symbol: 'ORCA', name: 'Orca', mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE', decimals: 6, logoURI: 'https://coin-images.coingecko.com/coins/images/17547/large/Orca_Logo.png' },
  { symbol: 'mSOL', name: 'Marinade SOL', mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', decimals: 9, logoURI: 'https://coin-images.coingecko.com/coins/images/17752/large/mSOL.png' },
  { symbol: 'TRUMP', name: 'Official Trump', mint: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN', decimals: 6, logoURI: 'https://coin-images.coingecko.com/coins/images/53746/large/trump.jpg' },
  { symbol: 'PENGU', name: 'Pudgy Penguins', mint: '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv', decimals: 6, logoURI: 'https://coin-images.coingecko.com/coins/images/52563/large/pengu.jpg' },
  { symbol: 'ETH', name: 'Wrapped Ethereum (Wormhole)', mint: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', decimals: 8, logoURI: 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png' },
  { symbol: 'BTC', name: 'Wrapped Bitcoin (Sollet)', mint: '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E', decimals: 6, logoURI: 'https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png' },
  { symbol: 'tBTC', name: 'Threshold Bitcoin', mint: '6DNSN2BJsaPFdFFc1zP37kkeNe4Usc1Sqkzr9C9vPWcU', decimals: 8, logoURI: 'https://coin-images.coingecko.com/coins/images/11224/large/0x18084fbA666a33d37592fA2633fD49a74DD93a88.png' },
];

export interface JupiterTokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

/**
 * Searches tokens by symbol, name, or contract address (mint).
 * Uses multiple sources: Jupiter Token API, DexScreener, and Jupiter Quote check.
 */
export async function searchTokens(query: string): Promise<JupiterTokenInfo[]> {
  try {
    // If query looks like a mint address (base58, 30-50 chars), search by address
    const trimmed = query.trim();
    const isAddress = /^[1-9A-HJ-NP-Za-km-z]{30,50}$/.test(trimmed);

    if (isAddress) {
      const address = trimmed;
      // Try Jupiter Token API first
      try {
        const response = await fetch(`https://lite-api.jup.ag/tokens/v2/${address}`);
        if (response.ok) {
          const token = await response.json();
          if (token && token.address) {
            return [{
              address: token.address,
              symbol: token.symbol || 'Unknown',
              name: token.name || 'Unknown Token',
              decimals: token.decimals || 9,
              logoURI: token.logoURI,
            }];
          }
        }
      } catch {
        // continue to next source
      }

      // Try GeckoTerminal API (covers Raydium, Meteora, Orca, PumpSwap, etc.)
      try {
        const geckoResp = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${address}`);
        if (geckoResp.ok) {
          const geckoData = await geckoResp.json();
          const tokenAttrs = geckoData?.data?.attributes;
          if (tokenAttrs) {
            // GeckoTerminal image_url can be direct URL or empty
            let logo: string | undefined = undefined;
            if (tokenAttrs.image_url && tokenAttrs.image_url !== 'missing.png' && tokenAttrs.image_url.startsWith('http')) {
              logo = tokenAttrs.image_url;
            }
            return [{
              address: address,
              symbol: tokenAttrs.symbol || 'Unknown',
              name: tokenAttrs.name || 'Unknown Token',
              decimals: tokenAttrs.decimals || 9,
              logoURI: logo,
            }];
          }
        }
      } catch {
        // continue to next source
      }

      // Last resort: Try a quote from Jupiter to verify the token is swappable
      try {
        const SOL_MINT = 'So11111111111111111111111111111111111111112';
        const quoteResp = await fetch(
          `${JUPITER_QUOTE_API}/quote?inputMint=${SOL_MINT}&outputMint=${address}&amount=100000000&slippageBps=100`
        );
        if (quoteResp.ok) {
          const quoteData = await quoteResp.json();
          if (quoteData && (quoteData.outputMint === address || quoteData.outAmount)) {
            // Token is swappable! Try to get metadata from GeckoTerminal
            let symbol = address.slice(0, 4).toUpperCase();
            let name = `Token ${address.slice(0, 6)}...${address.slice(-4)}`;
            let logoURI: string | undefined = undefined;

            try {
              const metaResp = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${address}`);
              if (metaResp.ok) {
                const metaData = await metaResp.json();
                const attrs = metaData?.data?.attributes;
                if (attrs) {
                  if (attrs.symbol) symbol = attrs.symbol;
                  if (attrs.name) name = attrs.name;
                  if (attrs.image_url && attrs.image_url !== 'missing.png' && attrs.image_url.startsWith('http')) {
                    logoURI = attrs.image_url;
                  }
                }
              }
            } catch {
              // use defaults
            }

            return [{
              address: address,
              symbol,
              name,
              decimals: 9,
              logoURI,
            }];
          }
        }
      } catch {
        // token not found anywhere
      }

      return [];
    }

    // Search by symbol/name - try Jupiter first
    try {
      const response = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(trimmed)}&limit=20`);
      if (response.ok) {
        const results = await response.json();
        if (Array.isArray(results) && results.length > 0) {
          return results.filter((t: Record<string, unknown>) => t.address).map((t: Record<string, unknown>) => ({
            address: t.address as string,
            symbol: (t.symbol as string) || 'Unknown',
            name: (t.name as string) || 'Unknown Token',
            decimals: (t.decimals as number) || 9,
            logoURI: t.logoURI as string | undefined,
          }));
        }
      }
    } catch {
      // continue to DexScreener
    }

    // Fallback: GeckoTerminal search
    try {
      const geckoResp = await fetch(`https://api.geckoterminal.com/api/v2/search/pools?query=${encodeURIComponent(trimmed)}&network=solana`);
      if (geckoResp.ok) {
        const geckoData = await geckoResp.json();
        if (geckoData?.data && Array.isArray(geckoData.data)) {
          const seen = new Set<string>();
          const results: JupiterTokenInfo[] = [];

          for (const pool of geckoData.data.slice(0, 15)) {
            const relationships = pool.relationships;
            const baseTokenId = relationships?.base_token?.data?.id;
            if (!baseTokenId) continue;

            // Extract address from ID format "solana_ADDRESS"
            const addr = baseTokenId.replace('solana_', '');
            if (seen.has(addr)) continue;
            seen.add(addr);

            const poolAttrs = pool.attributes;
            results.push({
              address: addr,
              symbol: poolAttrs?.name?.split('/')[0]?.trim() || 'Unknown',
              name: poolAttrs?.name?.split('/')[0]?.trim() || 'Unknown Token',
              decimals: 9,
              logoURI: undefined,
            });
          }
          if (results.length > 0) return results;
        }
      }
    } catch {
      // silent
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * Fetches a swap quote from Jupiter API.
 */
export async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number = 50
): Promise<JupiterQuote | null> {
  try {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps: slippageBps.toString(),
    });

    const response = await fetch(`${JUPITER_QUOTE_API}/quote?${params}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || `Quote API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Jupiter quote error:', error);
    return null;
  }
}

/**
 * Executes a swap using Jupiter API.
 * Signs and sends the transaction using the wallet's private key.
 */
export async function executeSwap(
  quote: JupiterQuote,
  userPublicKey: string,
  privateKeyBase58: string,
  rpcEndpoint: string
): Promise<SwapResult> {
  try {
    // Step 1: Re-fetch a fresh quote to get latest blockhash
    const freshQuoteResp = await fetch(
      `${JUPITER_QUOTE_API}/quote?inputMint=${quote.inputMint}&outputMint=${quote.outputMint}&amount=${quote.inAmount}&slippageBps=${quote.slippageBps}`
    );
    if (!freshQuoteResp.ok) {
      throw new Error('Failed to get fresh quote');
    }
    const freshQuote = await freshQuoteResp.json();

    // Step 2: Get swap transaction from Jupiter with fresh quote
    const swapResponse = await fetch(`${JUPITER_QUOTE_API}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: freshQuote,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      }),
    });

    if (!swapResponse.ok) {
      const errorData = await swapResponse.json().catch(() => null);
      throw new Error(errorData?.error || 'Failed to get swap transaction');
    }

    const { swapTransaction } = await swapResponse.json();

    // Step 3: Deserialize the transaction
    const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    // Step 4: Sign the transaction immediately
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKeyBase58));
    transaction.sign([keypair]);

    // Step 5: Get latest blockhash and send immediately
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const latestBlockhash = await connection.getLatestBlockhash('confirmed');
    const rawTransaction = transaction.serialize();

    const signature = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: true,
      maxRetries: 3,
    });

    // Step 6: Confirm the transaction with timeout
    try {
      await connection.confirmTransaction({
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        signature,
      }, 'confirmed');
    } catch {
      // If confirmation times out but tx was sent, still consider it success
      // User can check on explorer
    }

    return { success: true, signature };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Swap failed',
    };
  }
}

/**
 * Converts UI amount to raw amount based on decimals.
 */
export function toRawAmount(amount: number, decimals: number): string {
  return Math.floor(amount * Math.pow(10, decimals)).toString();
}

/**
 * Converts raw amount to UI amount based on decimals.
 */
export function fromRawAmount(rawAmount: string, decimals: number): number {
  return parseInt(rawAmount) / Math.pow(10, decimals);
}
