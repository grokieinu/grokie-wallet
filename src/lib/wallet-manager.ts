/**
 * GROKIE Wallet - Wallet Manager
 * 
 * High-level wallet operations that coordinate between
 * crypto, storage, session, and Solana modules.
 * 
 * SECURITY: This module orchestrates sensitive operations
 * and ensures proper encryption/decryption flow.
 */

import { encryptData, decryptData, hashPassword, generateSalt, bufferToHex } from './crypto';
import {
  saveWallet,
  getWallet,
  getAllWallets,
  deleteWallet as deleteWalletFromDB,
  saveSettings,
  getSettings,
  clearAllData,
  type WalletRecord,
  type SettingsRecord,
} from './storage';
import { createNewWallet, importFromSeedPhrase, importFromPrivateKey } from './solana';
import { getDefaultRpcEndpoint } from './rpc';
import {
  unlockSession,
  lockSession,
  getSessionState,
  getSessionPrivateKey,
  recordFailedAttempt,
  isLockedOut,
  resetPasswordAttempts,
} from './session';

export interface CreateWalletResult {
  publicKey: string;
  seedPhrase: string; // Must be shown to user once, then encrypted
}

export interface ImportWalletResult {
  publicKey: string;
}

/**
 * Creates a new wallet with a generated seed phrase.
 * SECURITY: Seed phrase is returned to show to user ONCE, then encrypted and stored.
 */
export async function createWallet(password: string, name: string = 'My Wallet'): Promise<CreateWalletResult> {
  const wallet = createNewWallet();

  // Encrypt private key and seed phrase with user's password
  const encryptedPrivateKey = await encryptData(wallet.privateKey, password);
  const encryptedSeedPhrase = wallet.seedPhrase
    ? await encryptData(wallet.seedPhrase, password)
    : undefined;

  // Hash password for future verification
  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);

  const walletRecord: WalletRecord = {
    id: crypto.randomUUID(),
    publicKey: wallet.publicKey,
    encryptedPrivateKey,
    encryptedSeedPhrase,
    passwordHash,
    passwordSalt: bufferToHex(salt),
    createdAt: Date.now(),
    name,
  };

  await saveWallet(walletRecord);

  // Initialize settings if first wallet
  const existingSettings = await getSettings();
  if (!existingSettings) {
    const settings: SettingsRecord = {
      id: 'default',
      rpcEndpoint: getDefaultRpcEndpoint(),
      autoLockMinutes: 5,
      lastActivity: Date.now(),
    };
    await saveSettings(settings);
  }

  // Unlock the session
  unlockSession(walletRecord.id, wallet.privateKey);

  return {
    publicKey: wallet.publicKey,
    seedPhrase: wallet.seedPhrase!,
  };
}

/**
 * Imports a wallet from a seed phrase.
 * SECURITY: Seed phrase is encrypted immediately after import.
 */
export async function importWalletFromSeed(
  seedPhrase: string,
  password: string,
  name: string = 'Imported Wallet'
): Promise<ImportWalletResult> {
  const wallet = importFromSeedPhrase(seedPhrase);

  const encryptedPrivateKey = await encryptData(wallet.privateKey, password);
  const encryptedSeedPhrase = await encryptData(seedPhrase, password);

  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);

  const walletRecord: WalletRecord = {
    id: crypto.randomUUID(),
    publicKey: wallet.publicKey,
    encryptedPrivateKey,
    encryptedSeedPhrase,
    passwordHash,
    passwordSalt: bufferToHex(salt),
    createdAt: Date.now(),
    name,
  };

  await saveWallet(walletRecord);
  unlockSession(walletRecord.id, wallet.privateKey);

  return { publicKey: wallet.publicKey };
}

/**
 * Imports a wallet from a private key.
 * SECURITY: Private key is encrypted immediately after import.
 * Note: No seed phrase available for key-only imports.
 */
export async function importWalletFromKey(
  privateKey: string,
  password: string,
  name: string = 'Imported Wallet'
): Promise<ImportWalletResult> {
  const wallet = importFromPrivateKey(privateKey);

  const encryptedPrivateKey = await encryptData(wallet.privateKey, password);

  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);

  const walletRecord: WalletRecord = {
    id: crypto.randomUUID(),
    publicKey: wallet.publicKey,
    encryptedPrivateKey,
    passwordHash,
    passwordSalt: bufferToHex(salt),
    createdAt: Date.now(),
    name,
  };

  await saveWallet(walletRecord);
  unlockSession(walletRecord.id, wallet.privateKey);

  return { publicKey: wallet.publicKey };
}

/**
 * Unlocks a wallet with the user's password.
 * SECURITY: Verifies password hash before decryption, rate-limits attempts.
 * If 2FA is enabled, requires a valid TOTP code as well.
 */
export async function unlockWallet(walletId: string, password: string, totpCode?: string): Promise<boolean> {
  // Check lockout status
  const lockout = isLockedOut();
  if (lockout.locked) {
    throw new Error(
      `Too many failed attempts. Try again in ${Math.ceil(lockout.remainingMs / 1000)} seconds.`
    );
  }

  const walletRecord = await getWallet(walletId);
  if (!walletRecord) {
    throw new Error('Wallet not found.');
  }

  // Verify password
  const { hexToBuffer } = await import('./crypto');
  const salt = hexToBuffer(walletRecord.passwordSalt);
  const computedHash = await hashPassword(password, salt);

  if (computedHash !== walletRecord.passwordHash) {
    const result = recordFailedAttempt();
    if (result.locked) {
      throw new Error(
        `Too many failed attempts. Account locked for ${Math.ceil(result.remainingMs / 60000)} minutes.`
      );
    }
    throw new Error('Incorrect password.');
  }

  // SECURITY: If 2FA is enabled, verify TOTP code
  if (walletRecord.twoFactorEnabled && walletRecord.encryptedTOTPSecret) {
    if (!totpCode) {
      throw new Error('2FA_REQUIRED');
    }

    const { decryptTOTPSecret, verifyTOTP } = await import('./two-factor');
    const totpSecret = await decryptTOTPSecret(walletRecord.encryptedTOTPSecret, password);

    if (!verifyTOTP(totpSecret, totpCode)) {
      throw new Error('Invalid 2FA code. Please check your authenticator app.');
    }
  }

  // Password (and 2FA if enabled) correct - decrypt private key
  resetPasswordAttempts();
  const privateKey = await decryptData(walletRecord.encryptedPrivateKey, password);
  unlockSession(walletId, privateKey);

  return true;
}

/**
 * Checks if a wallet has 2FA enabled.
 */
export async function is2FAEnabled(walletId: string): Promise<boolean> {
  const walletRecord = await getWallet(walletId);
  return walletRecord?.twoFactorEnabled ?? false;
}

/**
 * Changes the wallet password.
 * SECURITY: Re-encrypts all sensitive data with the new password.
 */
export async function changePassword(
  walletId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const walletRecord = await getWallet(walletId);
  if (!walletRecord) throw new Error('Wallet not found.');

  // Verify current password
  const { hexToBuffer } = await import('./crypto');
  const salt = hexToBuffer(walletRecord.passwordSalt);
  const computedHash = await hashPassword(currentPassword, salt);

  if (computedHash !== walletRecord.passwordHash) {
    throw new Error('Current password is incorrect.');
  }

  // Decrypt with old password
  const privateKey = await decryptData(walletRecord.encryptedPrivateKey, currentPassword);
  let seedPhrase: string | undefined;
  if (walletRecord.encryptedSeedPhrase) {
    seedPhrase = await decryptData(walletRecord.encryptedSeedPhrase, currentPassword);
  }

  // Re-encrypt with new password
  const newEncryptedPrivateKey = await encryptData(privateKey, newPassword);
  const newEncryptedSeedPhrase = seedPhrase
    ? await encryptData(seedPhrase, newPassword)
    : undefined;

  // New password hash
  const newSalt = generateSalt();
  const newPasswordHash = await hashPassword(newPassword, newSalt);

  // Update wallet record
  walletRecord.encryptedPrivateKey = newEncryptedPrivateKey;
  walletRecord.encryptedSeedPhrase = newEncryptedSeedPhrase;
  walletRecord.passwordHash = newPasswordHash;
  walletRecord.passwordSalt = bufferToHex(newSalt);

  await saveWallet(walletRecord);

  // Update session with new key reference
  unlockSession(walletId, privateKey);
}

/**
 * Exports the private key after password verification.
 * SECURITY: Requires password verification. Should show anti-phishing warning.
 */
export async function exportPrivateKey(walletId: string, password: string): Promise<string> {
  const walletRecord = await getWallet(walletId);
  if (!walletRecord) throw new Error('Wallet not found.');

  const { hexToBuffer } = await import('./crypto');
  const salt = hexToBuffer(walletRecord.passwordSalt);
  const computedHash = await hashPassword(password, salt);

  if (computedHash !== walletRecord.passwordHash) {
    throw new Error('Incorrect password.');
  }

  return decryptData(walletRecord.encryptedPrivateKey, password);
}

/**
 * Exports the recovery phrase after password verification.
 * SECURITY: Only available if wallet was created (not imported via key).
 */
export async function exportSeedPhrase(walletId: string, password: string): Promise<string> {
  const walletRecord = await getWallet(walletId);
  if (!walletRecord) throw new Error('Wallet not found.');

  if (!walletRecord.encryptedSeedPhrase) {
    throw new Error('No recovery phrase available. This wallet was imported with a private key.');
  }

  const { hexToBuffer } = await import('./crypto');
  const salt = hexToBuffer(walletRecord.passwordSalt);
  const computedHash = await hashPassword(password, salt);

  if (computedHash !== walletRecord.passwordHash) {
    throw new Error('Incorrect password.');
  }

  return decryptData(walletRecord.encryptedSeedPhrase, password);
}

/**
 * Deletes a wallet permanently.
 * SECURITY: Clears all data from storage and locks session.
 */
export async function deleteWalletPermanently(walletId: string, password: string): Promise<void> {
  const walletRecord = await getWallet(walletId);
  if (!walletRecord) throw new Error('Wallet not found.');

  const { hexToBuffer } = await import('./crypto');
  const salt = hexToBuffer(walletRecord.passwordSalt);
  const computedHash = await hashPassword(password, salt);

  if (computedHash !== walletRecord.passwordHash) {
    throw new Error('Incorrect password.');
  }

  await deleteWalletFromDB(walletId);
  lockSession();

  // Check if any wallets remain
  const remaining = await getAllWallets();
  if (remaining.length === 0) {
    await clearAllData();
  }
}

/**
 * Gets the current wallet's public info.
 */
export async function getCurrentWallet(): Promise<WalletRecord | null> {
  const state = getSessionState();
  if (!state.walletId) return null;

  const wallet = await getWallet(state.walletId);
  return wallet || null;
}

/**
 * Gets decrypted private key from active session.
 * SECURITY: Only returns key if session is active and unlocked.
 */
export function getActivePrivateKey(): string | null {
  return getSessionPrivateKey();
}

/**
 * Locks the current wallet session.
 */
export function lockCurrentWallet(): void {
  lockSession();
}

/**
 * Checks if there's an active, unlocked session.
 */
export function isWalletUnlocked(): boolean {
  return getSessionState().isUnlocked;
}

/**
 * Gets the active wallet ID.
 */
export function getActiveWalletId(): string | null {
  return getSessionState().walletId;
}
