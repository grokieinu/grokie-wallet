/**
 * GROKIE Wallet - Two-Factor Authentication (2FA)
 * 
 * Implements TOTP (Time-based One-Time Password) for additional security.
 * Compatible with Google Authenticator, Authy, and other TOTP apps.
 * 
 * SECURITY:
 * - 2FA secret is encrypted with the user's password before storage
 * - Secret never leaves the device unencrypted
 * - Uses RFC 6238 TOTP standard (SHA-1, 6 digits, 30s period)
 */

import * as OTPAuth from 'otpauth';
import { encryptData, decryptData } from './crypto';

const ISSUER = 'GROKIE Wallet';
const DIGITS = 6;
const PERIOD = 30; // seconds
const ALGORITHM = 'SHA1';

export interface TwoFactorSetup {
  secret: string; // Base32 encoded secret
  uri: string; // otpauth:// URI for QR code
}

/**
 * Generates a new TOTP secret for 2FA setup.
 * Returns the secret and URI for QR code scanning.
 */
export function generateTOTPSecret(accountName: string): TwoFactorSetup {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: accountName,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
  });

  return {
    secret: totp.secret.base32,
    uri: totp.toString(),
  };
}

/**
 * Validates a TOTP code against a secret.
 * Allows 1 period window (±30s) to account for clock drift.
 */
export function verifyTOTP(secret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  // window: 1 means ±1 period (±30 seconds)
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

/**
 * Encrypts the TOTP secret for safe storage.
 * SECURITY: Secret is encrypted with the user's password.
 */
export async function encryptTOTPSecret(secret: string, password: string): Promise<ArrayBuffer> {
  return encryptData(secret, password);
}

/**
 * Decrypts a stored TOTP secret.
 */
export async function decryptTOTPSecret(encryptedSecret: ArrayBuffer, password: string): Promise<string> {
  return decryptData(encryptedSecret, password);
}

/**
 * Generates the current TOTP code (for testing/display purposes only).
 */
export function generateCurrentCode(secret: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  return totp.generate();
}
