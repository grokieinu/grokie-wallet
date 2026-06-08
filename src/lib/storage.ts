/**
 * GROKIE Wallet - Secure Storage Layer (IndexedDB)
 * 
 * SECURITY CRITICAL:
 * - All wallet data is stored encrypted in IndexedDB
 * - No plaintext private keys or seed phrases are ever stored
 * - Only encrypted blobs and public metadata are persisted
 * - Data never leaves the browser
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'grokie-wallet-db';
const DB_VERSION = 2;

// Store names
const STORES = {
  WALLET: 'wallet',
  SETTINGS: 'settings',
  TRANSACTIONS: 'transactions',
  CUSTOM_TOKENS: 'customTokens',
} as const;

interface WalletRecord {
  id: string;
  publicKey: string;
  encryptedPrivateKey: ArrayBuffer; // AES-256-GCM encrypted
  encryptedSeedPhrase?: ArrayBuffer; // AES-256-GCM encrypted (only if created, not imported via key)
  passwordHash: string; // SHA-256 hash for verification
  passwordSalt: string; // Salt used for password hashing
  createdAt: number;
  name: string;
  // 2FA
  twoFactorEnabled?: boolean;
  encryptedTOTPSecret?: ArrayBuffer; // AES-256-GCM encrypted TOTP secret
}

interface SettingsRecord {
  id: string;
  rpcEndpoint: string;
  autoLockMinutes: number;
  lastActivity: number;
}

interface TransactionRecord {
  id: string;
  walletId: string;
  signature: string;
  type: 'send' | 'receive';
  amount: number;
  token: string;
  to: string;
  from: string;
  timestamp: number;
  status: 'confirmed' | 'failed' | 'pending';
}

interface CustomTokenRecord {
  id: string; // mint address used as id
  walletId: string;
  mintAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
  addedAt: number;
}

export type { WalletRecord, SettingsRecord, TransactionRecord, CustomTokenRecord };

let dbInstance: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  try {
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Wallet store
        if (!db.objectStoreNames.contains(STORES.WALLET)) {
          db.createObjectStore(STORES.WALLET, { keyPath: 'id' });
        }
        // Settings store
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
        }
        // Transactions store
        if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
          const txStore = db.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'id' });
          txStore.createIndex('walletId', 'walletId');
          txStore.createIndex('timestamp', 'timestamp');
        }
        // Custom tokens store (added in version 2)
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains(STORES.CUSTOM_TOKENS)) {
            const tokenStore = db.createObjectStore(STORES.CUSTOM_TOKENS, { keyPath: 'id' });
            tokenStore.createIndex('walletId', 'walletId');
          }
        }
      },
      blocked() {
        // Another tab has the DB open with old version
        // Close our cached instance so next call retries
        dbInstance = null;
      },
    });
  } catch (error) {
    // SECURITY: Do not log DB internals
    dbInstance = null;
    throw error;
  }

  return dbInstance;
}

// === Wallet Operations ===

export async function saveWallet(wallet: WalletRecord): Promise<void> {
  const db = await getDB();
  await db.put(STORES.WALLET, wallet);
}

export async function getWallet(id: string): Promise<WalletRecord | undefined> {
  const db = await getDB();
  return db.get(STORES.WALLET, id);
}

export async function getAllWallets(): Promise<WalletRecord[]> {
  const db = await getDB();
  return db.getAll(STORES.WALLET);
}

export async function deleteWallet(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORES.WALLET, id);
  // Also delete associated transactions
  const tx = db.transaction(STORES.TRANSACTIONS, 'readwrite');
  const index = tx.store.index('walletId');
  const transactions = await index.getAllKeys(id);
  for (const key of transactions) {
    await tx.store.delete(key);
  }
  await tx.done;
  // Also delete associated custom tokens
  const tx2 = db.transaction(STORES.CUSTOM_TOKENS, 'readwrite');
  const tokenIndex = tx2.store.index('walletId');
  const tokens = await tokenIndex.getAllKeys(id);
  for (const key of tokens) {
    await tx2.store.delete(key);
  }
  await tx2.done;
}

// === Settings Operations ===

export async function saveSettings(settings: SettingsRecord): Promise<void> {
  const db = await getDB();
  await db.put(STORES.SETTINGS, settings);
}

export async function getSettings(): Promise<SettingsRecord | undefined> {
  const db = await getDB();
  const all = await db.getAll(STORES.SETTINGS);
  return all[0];
}

// === Transaction Operations ===

export async function saveTransaction(transaction: TransactionRecord): Promise<void> {
  const db = await getDB();
  await db.put(STORES.TRANSACTIONS, transaction);
}

export async function getTransactions(walletId: string): Promise<TransactionRecord[]> {
  const db = await getDB();
  const tx = db.transaction(STORES.TRANSACTIONS, 'readonly');
  const index = tx.store.index('walletId');
  const transactions = await index.getAll(walletId);
  return transactions.sort((a, b) => b.timestamp - a.timestamp);
}

// === Custom Token Operations ===

export async function saveCustomToken(token: CustomTokenRecord): Promise<void> {
  try {
    const db = await getDB();
    await db.put(STORES.CUSTOM_TOKENS, token);
  } catch (error) {
    // If DB upgrade failed or store doesn't exist, try to recreate connection
    dbInstance = null;
    const db = await getDB();
    await db.put(STORES.CUSTOM_TOKENS, token);
  }
}

export async function getCustomTokens(walletId: string): Promise<CustomTokenRecord[]> {
  const db = await getDB();
  const tx = db.transaction(STORES.CUSTOM_TOKENS, 'readonly');
  const index = tx.store.index('walletId');
  return index.getAll(walletId);
}

export async function deleteCustomToken(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORES.CUSTOM_TOKENS, id);
}

export async function getCustomToken(id: string): Promise<CustomTokenRecord | undefined> {
  const db = await getDB();
  return db.get(STORES.CUSTOM_TOKENS, id);
}

// === Database Cleanup ===

/**
 * SECURITY: Completely wipes all wallet data from IndexedDB.
 * Used when user deletes their wallet.
 */
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await db.clear(STORES.WALLET);
  await db.clear(STORES.SETTINGS);
  await db.clear(STORES.TRANSACTIONS);
  await db.clear(STORES.CUSTOM_TOKENS);
}

/**
 * Updates last activity timestamp for auto-lock feature.
 */
export async function updateLastActivity(): Promise<void> {
  const settings = await getSettings();
  if (settings) {
    settings.lastActivity = Date.now();
    await saveSettings(settings);
  }
}
