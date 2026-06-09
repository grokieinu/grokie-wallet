/**
 * GROKIE Wallet - RPC Configuration
 * 
 * Helius API key is loaded from environment variable (NEXT_PUBLIC_HELIUS_API_KEY)
 * which is stored in .env.local and never committed to git.
 */

const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';

/**
 * Returns the default Helius RPC endpoint with API key from env.
 * Falls back to public Solana RPC if no key is configured.
 */
export function getDefaultRpcEndpoint(): string {
  if (HELIUS_API_KEY) {
    return `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
  }
  return 'https://api.mainnet-beta.solana.com';
}
