/**
 * GROKIE Wallet - Swap Service (GROKIE Swap)
 * 
 * Integrates with Jupiter Aggregator API for token swaps.
 * Jupiter finds the best route across all Solana DEXs.
 * 
 * SECURITY: Private key is only used for signing the swap transaction locally.
 * No keys are ever sent to Jupiter or any external service.
 */

import {
  Connection,
  Keypair,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote';
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6/swap';

// Native SOL mint address
export const SOL_MINT = 'So11111111111111111111111111111111111111112';

// GROKIE Swap referral account — earns platform fees from Jupiter swaps
const REFERRAL_ACCOUNT = 'BW3zX4noKZdgdUDcf19kVzR2kBgeKaXA29K7WLBRbqRi';
const REFERRAL_FEE_BPS = 50; // 0.5% platform fee

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      label: string;
      inputMint: string;
      outputMint: string;
    };
    percent: number;
  }>;
  slippageBps: number;
  // Raw quote response for swap execution
  rawQuote: unknown;
}

export interface SwapResult {
  success: boolean;
  signature?: string;
  error?: string;
}

/**
 * Gets a swap quote from Jupiter.
 * @param inputMint - Token to sell (mint address)
 * @param outputMint - Token to buy (mint address)
 * @param amount - Amount in smallest unit (lamports/raw)
 * @param slippageBps - Slippage tolerance in basis points (50 = 0.5%)
 */
export async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number = 50
): Promise<SwapQuote | null> {
  try {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps: slippageBps.toString(),
      onlyDirectRoutes: 'false',
      asLegacyTransaction: 'false',
    });

    const response = await fetch(`${JUPITER_QUOTE_API}?${params}`);
    
    if (!response.ok) {
      const errText = await response.text();
      if (errText.includes('No route') || errText.includes('ROUTE_NOT_FOUND') || response.status === 400) {
        return null;
      }
      throw new Error(errText);
    }

    const data = await response.json();

    if (!data || !data.outAmount || data.outAmount === '0') {
      return null;
    }

    return {
      inputMint: data.inputMint,
      outputMint: data.outputMint,
      inAmount: data.inAmount,
      outAmount: data.outAmount,
      otherAmountThreshold: data.otherAmountThreshold,
      priceImpactPct: data.priceImpactPct || '0',
      routePlan: data.routePlan || [],
      slippageBps,
      rawQuote: data,
    };
  } catch (error) {
    // SECURITY: Do not log sensitive swap details
    return null;
  }
}

/**
 * Executes a swap using Jupiter.
 * SECURITY: Private key is used ONLY for signing locally. Never transmitted.
 */
export async function executeSwap(
  quote: SwapQuote,
  walletPublicKey: string,
  privateKeyBase58: string,
  rpcEndpoint: string
): Promise<SwapResult> {
  try {
    // Get serialized transaction from Jupiter
    const swapResponse = await fetch(JUPITER_SWAP_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote.rawQuote,
        userPublicKey: walletPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
        feeAccount: REFERRAL_ACCOUNT,
      }),
    });

    if (!swapResponse.ok) {
      const err = await swapResponse.text();
      throw new Error(`Swap API failed: ${err}`);
    }

    const { swapTransaction } = await swapResponse.json();

    // Deserialize and sign transaction locally
    const transactionBuf = Buffer.from(swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(transactionBuf);

    // SECURITY: Sign locally with private key
    const secretKey = bs58.decode(privateKeyBase58);
    const keypair = Keypair.fromSecretKey(secretKey);
    transaction.sign([keypair]);

    // Send to Solana network
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const rawTransaction = transaction.serialize();
    const signature = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      maxRetries: 3,
    });

    // Confirm transaction
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');

    if (confirmation.value.err) {
      return { success: false, error: 'Transaction confirmed but failed on-chain.' };
    }

    return { success: true, signature };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Swap failed';
    return { success: false, error: message };
  }
}

/**
 * Converts a human-readable amount to raw amount (smallest unit).
 */
export function toRawAmount(amount: number, decimals: number): string {
  return Math.floor(amount * Math.pow(10, decimals)).toString();
}

/**
 * Converts raw amount to human-readable.
 */
export function fromRawAmount(rawAmount: string, decimals: number): number {
  return parseInt(rawAmount) / Math.pow(10, decimals);
}
