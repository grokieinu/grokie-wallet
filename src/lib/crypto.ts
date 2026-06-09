/**
 * GROKIE Wallet - Cryptographic Operations
 * 
 * SECURITY CRITICAL: This module handles all encryption/decryption operations.
 * - Uses Web Crypto API for AES-256-GCM encryption
 * - Key derivation via PBKDF2 with 600,000 iterations
 * - All operations happen client-side only
 * - No private keys or seed phrases are ever transmitted
 */

// SECURITY: Number of PBKDF2 iterations - high to resist brute force
const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 32;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

/**
 * Checks if Web Crypto subtle API is available.
 * It's only available in secure contexts (HTTPS or localhost).
 */
function isSubtleAvailable(): boolean {
  return typeof globalThis !== 'undefined' &&
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.subtle !== 'undefined';
}

/**
 * Gets the crypto object for random values generation.
 * crypto.getRandomValues is available even in non-secure contexts.
 */
function getCrypto(): Crypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  throw new Error('Crypto API is not available in this environment.');
}

/**
 * Ensures crypto.subtle is available or throws a user-friendly error.
 */
function requireSubtle(): SubtleCrypto {
  if (!isSubtleAvailable()) {
    throw new Error(
      'Web Crypto API (crypto.subtle) is not available. ' +
      'This wallet requires a secure context. Please access via https:// or http://localhost:3000'
    );
  }
  return globalThis.crypto.subtle;
}

/**
 * Helper to convert Uint8Array to ArrayBuffer for Web Crypto API compatibility.
 */
function toBuffer(arr: Uint8Array): ArrayBuffer {
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

/**
 * Derives an AES-256 key from a user password using PBKDF2.
 * SECURITY: High iteration count makes brute-force attacks infeasible.
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = requireSubtle();
  const encoder = new TextEncoder();

  const keyMaterial = await subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts sensitive data (private keys, seed phrases) using AES-256-GCM.
 * SECURITY: Each encryption uses a unique IV to prevent ciphertext analysis.
 * Returns a combined buffer: salt (32 bytes) + iv (12 bytes) + ciphertext.
 */
export async function encryptData(plaintext: string, password: string): Promise<ArrayBuffer> {
  const subtle = requireSubtle();
  const c = getCrypto();
  const encoder = new TextEncoder();
  const salt = c.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = c.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);

  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv: toBuffer(iv) },
    key,
    encoder.encode(plaintext)
  );

  // Combine salt + iv + ciphertext into a single buffer
  const combined = new Uint8Array(SALT_LENGTH + IV_LENGTH + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, SALT_LENGTH);
  combined.set(new Uint8Array(ciphertext), SALT_LENGTH + IV_LENGTH);

  return combined.buffer;
}

/**
 * Decrypts data encrypted with encryptData.
 * SECURITY: Will throw if password is incorrect (authentication tag mismatch).
 */
export async function decryptData(encryptedBuffer: ArrayBuffer, password: string): Promise<string> {
  const subtle = requireSubtle();
  const combined = new Uint8Array(encryptedBuffer);
  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);

  const key = await deriveKey(password, salt);

  const decrypted = await subtle.decrypt(
    { name: 'AES-GCM', iv: toBuffer(iv) },
    key,
    toBuffer(ciphertext)
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Generates a cryptographically secure random salt.
 */
export function generateSalt(): Uint8Array {
  return getCrypto().getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Hashes a password for verification purposes (not for encryption).
 * Uses SHA-256 with a salt to verify password without storing it.
 */
export async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const subtle = requireSubtle();
  const encoder = new TextEncoder();
  const data = new Uint8Array([...salt, ...encoder.encode(password)]);
  const hash = await subtle.digest('SHA-256', toBuffer(data));
  return bufferToHex(new Uint8Array(hash));
}

/**
 * Converts a Uint8Array to a hex string.
 */
export function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converts a hex string to Uint8Array.
 */
export function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * SECURITY: Securely wipes a Uint8Array from memory by overwriting.
 * Note: JavaScript's GC may still retain copies; this is a best-effort measure.
 */
export function secureWipe(arr: Uint8Array): void {
  getCrypto().getRandomValues(arr);
  arr.fill(0);
}

/**
 * Checks if the current environment supports all required crypto operations.
 * Returns an object indicating availability and a user-friendly message.
 */
export function checkCryptoSupport(): { supported: boolean; message: string } {
  if (typeof globalThis === 'undefined' || !globalThis.crypto) {
    return {
      supported: false,
      message: 'Your browser does not support the Crypto API.',
    };
  }
  if (!globalThis.crypto.subtle) {
    return {
      supported: false,
      message: 'Crypto operations require a secure context. Please use HTTPS or access via http://localhost:3000',
    };
  }
  return { supported: true, message: '' };
}
