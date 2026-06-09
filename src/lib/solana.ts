/**
 * GROKIE Wallet - Solana Blockchain Integration
 * 
 * Handles all interactions with the Solana blockchain:
 * - Wallet creation and key derivation
 * - Balance queries
 * - Token operations
 * - Transaction submission
 * 
 * SECURITY: Private keys are only held in memory during operations
 * and are never logged or transmitted.
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  type TransactionSignature,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import bs58 from 'bs58';

// Default RPC endpoint (Solana Mainnet) - loaded from environment
import { getDefaultRpcEndpoint } from './rpc';
const DEFAULT_RPC = getDefaultRpcEndpoint();

// Solana derivation path (BIP44)
const DERIVATION_PATH = "m/44'/501'/0'/0'";

export interface WalletKeys {
  publicKey: string;
  privateKey: string; // Base58 encoded
  seedPhrase?: string;
}

export interface TokenBalance {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
  uiBalance: string;
  logoURI?: string;
}

export interface TransactionResult {
  signature: string;
  success: boolean;
  error?: string;
}

/**
 * Creates a new Solana wallet with a BIP39 mnemonic seed phrase.
 * SECURITY: The returned seed phrase must be encrypted before storage.
 */
export function createNewWallet(): WalletKeys {
  // Generate a 12-word mnemonic
  const mnemonic = bip39.generateMnemonic();
  const seed = bip39.mnemonicToSeedSync(mnemonic);

  // Derive the keypair using BIP44 path
  const derivedSeed = derivePath(DERIVATION_PATH, seed.toString('hex')).key;
  const keypair = Keypair.fromSeed(derivedSeed);

  return {
    publicKey: keypair.publicKey.toBase58(),
    privateKey: bs58.encode(keypair.secretKey),
    seedPhrase: mnemonic,
  };
}

/**
 * Imports a wallet from a BIP39 seed phrase.
 * SECURITY: Seed phrase must not be logged or transmitted.
 */
export function importFromSeedPhrase(mnemonic: string): WalletKeys {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Invalid seed phrase. Please check and try again.');
  }

  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const derivedSeed = derivePath(DERIVATION_PATH, seed.toString('hex')).key;
  const keypair = Keypair.fromSeed(derivedSeed);

  return {
    publicKey: keypair.publicKey.toBase58(),
    privateKey: bs58.encode(keypair.secretKey),
    seedPhrase: mnemonic,
  };
}

/**
 * Imports a wallet from a Base58-encoded private key.
 * SECURITY: Private key must not be logged or transmitted.
 */
export function importFromPrivateKey(privateKeyBase58: string): WalletKeys {
  try {
    const secretKey = bs58.decode(privateKeyBase58);
    const keypair = Keypair.fromSecretKey(secretKey);
    return {
      publicKey: keypair.publicKey.toBase58(),
      privateKey: privateKeyBase58,
    };
  } catch {
    throw new Error('Invalid private key format. Please provide a valid Base58 private key.');
  }
}

/**
 * Gets a Solana connection instance.
 */
export function getConnection(rpcEndpoint?: string): Connection {
  return new Connection(rpcEndpoint || DEFAULT_RPC, 'confirmed');
}

/**
 * Fetches SOL balance for a public key.
 */
export async function getSOLBalance(publicKey: string, rpcEndpoint?: string): Promise<number> {
  const connection = getConnection(rpcEndpoint);
  const pubkey = new PublicKey(publicKey);
  const balance = await connection.getBalance(pubkey);
  return balance / LAMPORTS_PER_SOL;
}

/**
 * Fetches all SPL token balances for a wallet.
 * Queries both TOKEN_PROGRAM_ID (classic SPL) and TOKEN_2022_PROGRAM_ID.
 * Enriches with symbol/name from Jupiter token list.
 */
export async function getSPLTokenBalances(
  publicKey: string,
  rpcEndpoint?: string
): Promise<TokenBalance[]> {
  const connection = getConnection(rpcEndpoint);
  const pubkey = new PublicKey(publicKey);

  // Query both SPL Token and Token-2022 programs
  const [classicAccounts, token2022Accounts] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: TOKEN_PROGRAM_ID,
    }).catch(() => ({ value: [] })),
    connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: TOKEN_2022_PROGRAM_ID,
    }).catch(() => ({ value: [] })),
  ]);

  const allAccounts = [...classicAccounts.value, ...token2022Accounts.value];

  const rawTokens = allAccounts
    .map((account) => {
      const info = account.account.data.parsed.info;
      const tokenAmount = info.tokenAmount;
      return {
        mint: info.mint as string,
        balance: tokenAmount.uiAmount || 0,
        decimals: tokenAmount.decimals as number,
        uiBalance: (tokenAmount.uiAmountString || '0') as string,
      };
    })
    .filter((token) => token.balance > 0);

  // Fetch token metadata from Jupiter token list
  const { getTokensMetadata } = await import('./token-list');
  const mints = rawTokens.map((t) => t.mint);
  const metadata = await getTokensMetadata(mints);

  return rawTokens.map((token) => {
    const meta = metadata.get(token.mint);
    return {
      mint: token.mint,
      symbol: meta?.symbol || '',
      name: meta?.name || '',
      balance: token.balance,
      decimals: token.decimals,
      uiBalance: token.uiBalance,
      logoURI: meta?.logoURI || undefined,
    };
  });
}

/**
 * Sends SOL to a recipient address.
 * SECURITY: Private key is only used for signing and should be cleared after.
 */
export async function sendSOL(
  privateKeyBase58: string,
  toAddress: string,
  amountSOL: number,
  rpcEndpoint?: string
): Promise<TransactionResult> {
  try {
    // Validate recipient address
    if (!isValidSolanaAddress(toAddress)) {
      return { signature: '', success: false, error: 'Invalid recipient address' };
    }

    const connection = getConnection(rpcEndpoint);
    const secretKey = bs58.decode(privateKeyBase58);
    const fromKeypair = Keypair.fromSecretKey(secretKey);
    const toPubkey = new PublicKey(toAddress);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey,
        lamports: Math.round(amountSOL * LAMPORTS_PER_SOL),
      })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair]);

    return { signature, success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transaction failed';
    return { signature: '', success: false, error: message };
  }
}

/**
 * Sends SPL tokens to a recipient address.
 * SECURITY: Private key is only used for signing and should be cleared after.
 */
export async function sendSPLToken(
  privateKeyBase58: string,
  toAddress: string,
  mintAddress: string,
  amount: number,
  decimals: number,
  rpcEndpoint?: string
): Promise<TransactionResult> {
  try {
    if (!isValidSolanaAddress(toAddress)) {
      return { signature: '', success: false, error: 'Invalid recipient address' };
    }

    const connection = getConnection(rpcEndpoint);
    const secretKey = bs58.decode(privateKeyBase58);
    const fromKeypair = Keypair.fromSecretKey(secretKey);
    const toPubkey = new PublicKey(toAddress);
    const mintPubkey = new PublicKey(mintAddress);

    const fromTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      fromKeypair.publicKey
    );

    const toTokenAccount = await getAssociatedTokenAddress(mintPubkey, toPubkey);

    // Check if destination token account exists
    try {
      await getAccount(connection, toTokenAccount);
    } catch {
      return {
        signature: '',
        success: false,
        error: 'Recipient does not have an associated token account for this token.',
      };
    }

    const rawAmount = Math.round(amount * Math.pow(10, decimals));

    const transaction = new Transaction().add(
      createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromKeypair.publicKey,
        rawAmount
      )
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair]);

    return { signature, success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token transfer failed';
    return { signature: '', success: false, error: message };
  }
}

/**
 * Validates a Solana address format.
 * Note: Does NOT use isOnCurve — token mints and PDAs are valid addresses
 * that are not on the ed25519 curve.
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    // Valid if it's a proper 32-byte base58 public key
    return address.length >= 32 && address.length <= 44;
  } catch {
    return false;
  }
}

/**
 * Gets recent transaction signatures for a wallet.
 */
export async function getRecentTransactions(
  publicKey: string,
  limit: number = 20,
  rpcEndpoint?: string
): Promise<Array<{
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown;
}>> {
  const connection = getConnection(rpcEndpoint);
  const pubkey = new PublicKey(publicKey);

  const signatures = await connection.getSignaturesForAddress(pubkey, { limit });

  return signatures.map((sig) => ({
    signature: sig.signature,
    slot: sig.slot,
    blockTime: sig.blockTime ?? null,
    err: sig.err,
  }));
}

/**
 * Gets the Solana Explorer URL for a transaction.
 */
export function getExplorerUrl(signature: string, cluster: string = 'mainnet-beta'): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
}

/**
 * Estimates transaction fee.
 */
export async function estimateTransactionFee(rpcEndpoint?: string): Promise<number> {
  const connection = getConnection(rpcEndpoint);
  const { feeCalculator } = await connection.getRecentBlockhash();
  return (feeCalculator?.lamportsPerSignature || 5000) / LAMPORTS_PER_SOL;
}

/**
 * Fetches on-chain metadata for a token mint address.
 * Returns decimals and supply info from the Solana network.
/**
 * Fetches on-chain metadata for a token mint address.
 * Tries Jupiter token list first (faster, no rate limit), then falls back to RPC.
 * Supports both SPL Token and Token-2022 programs.
 */
export async function getTokenMintInfo(
  mintAddress: string,
  rpcEndpoint?: string
): Promise<{ decimals: number; supply: number } | null> {
  // First try Jupiter token list (no rate limit, instant)
  try {
    const { getTokenMetadata } = await import('./token-list');
    const meta = await getTokenMetadata(mintAddress);
    if (meta) {
      return {
        decimals: meta.decimals,
        supply: 0,
      };
    }
  } catch {
    // Jupiter failed, try RPC
  }

  // Fallback to on-chain RPC query
  try {
    const connection = getConnection(rpcEndpoint);
    const mintPubkey = new PublicKey(mintAddress);
    const info = await connection.getParsedAccountInfo(mintPubkey);

    if (!info.value) return null;

    const data = info.value.data;
    if ('parsed' in data) {
      if (data.program === 'spl-token' || data.program === 'spl-token-2022') {
        const mintData = data.parsed.info;
        return {
          decimals: mintData.decimals ?? 0,
          supply: mintData.supply ? Number(mintData.supply) / Math.pow(10, mintData.decimals ?? 0) : 0,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Gets the token balance for a specific mint address in a wallet.
 */
export async function getTokenBalanceForMint(
  walletPublicKey: string,
  mintAddress: string,
  rpcEndpoint?: string
): Promise<{ balance: number; uiBalance: string; decimals: number } | null> {
  try {
    const connection = getConnection(rpcEndpoint);
    const walletPubkey = new PublicKey(walletPublicKey);
    const mintPubkey = new PublicKey(mintAddress);

    const tokenAccount = await getAssociatedTokenAddress(mintPubkey, walletPubkey);

    try {
      const account = await getAccount(connection, tokenAccount);
      const mintInfo = await getTokenMintInfo(mintAddress, rpcEndpoint);
      const decimals = mintInfo?.decimals || 0;
      const balance = Number(account.amount) / Math.pow(10, decimals);

      return {
        balance,
        uiBalance: balance.toString(),
        decimals,
      };
    } catch {
      // Token account doesn't exist — wallet has 0 of this token
      return { balance: 0, uiBalance: '0', decimals: 0 };
    }
  } catch {
    return null;
  }
}

/**
 * Validates if a string is a valid SPL token mint address.
 */
export async function isValidTokenMint(
  mintAddress: string,
  rpcEndpoint?: string
): Promise<boolean> {
  try {
    const info = await getTokenMintInfo(mintAddress, rpcEndpoint);
    return info !== null;
  } catch {
    return false;
  }
}
