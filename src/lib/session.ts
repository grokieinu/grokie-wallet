/**
 * GROKIE Wallet - Secure Session Management
 * 
 * SECURITY CRITICAL:
 * - Manages wallet lock/unlock state in memory only
 * - Auto-locks wallet after configurable inactivity period
 * - Clears sensitive data from memory on lock
 * - Rate limits password attempts to prevent brute force
 * - Session state is never persisted to storage
 */

const MAX_PASSWORD_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_AUTO_LOCK_MS = 5 * 60 * 1000; // 5 minutes

interface SessionState {
  isUnlocked: boolean;
  walletId: string | null;
  // SECURITY: Decrypted private key held in memory only while unlocked
  decryptedPrivateKey: string | null;
  lastActivity: number;
  autoLockMs: number;
  passwordAttempts: number;
  lockoutUntil: number | null;
}

let session: SessionState = {
  isUnlocked: false,
  walletId: null,
  decryptedPrivateKey: null,
  lastActivity: Date.now(),
  autoLockMs: DEFAULT_AUTO_LOCK_MS,
  passwordAttempts: 0,
  lockoutUntil: null,
};

let autoLockTimer: ReturnType<typeof setTimeout> | null = null;
let activityListeners: Array<() => void> = [];

/**
 * Unlocks the session with the decrypted private key.
 * SECURITY: Private key is stored in memory only.
 */
export function unlockSession(walletId: string, privateKey: string, autoLockMinutes?: number): void {
  session = {
    isUnlocked: true,
    walletId,
    decryptedPrivateKey: privateKey,
    lastActivity: Date.now(),
    autoLockMs: (autoLockMinutes || 5) * 60 * 1000,
    passwordAttempts: 0,
    lockoutUntil: null,
  };

  resetAutoLockTimer();
  setupActivityListeners();
}

/**
 * Locks the session and clears sensitive data from memory.
 * SECURITY: Overwrites private key reference and nullifies all sensitive fields.
 */
export function lockSession(): void {
  // SECURITY: Clear the private key from memory
  if (session.decryptedPrivateKey) {
    session.decryptedPrivateKey = null;
  }

  session = {
    ...session,
    isUnlocked: false,
    decryptedPrivateKey: null,
  };

  clearAutoLockTimer();
  removeActivityListeners();
}

/**
 * Gets the current session state (without exposing private key).
 */
export function getSessionState(): { isUnlocked: boolean; walletId: string | null } {
  // SECURITY: Check if auto-lock should trigger
  if (session.isUnlocked && Date.now() - session.lastActivity > session.autoLockMs) {
    lockSession();
  }

  return {
    isUnlocked: session.isUnlocked,
    walletId: session.walletId,
  };
}

/**
 * Gets the decrypted private key from session.
 * SECURITY: Only returns key if session is unlocked and active.
 */
export function getSessionPrivateKey(): string | null {
  if (!session.isUnlocked) return null;

  // Check auto-lock
  if (Date.now() - session.lastActivity > session.autoLockMs) {
    lockSession();
    return null;
  }

  return session.decryptedPrivateKey;
}

/**
 * Records a failed password attempt and checks for lockout.
 * SECURITY: Rate limiting prevents brute-force attacks.
 */
export function recordFailedAttempt(): { locked: boolean; remainingMs: number } {
  session.passwordAttempts++;

  if (session.passwordAttempts >= MAX_PASSWORD_ATTEMPTS) {
    session.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
    return { locked: true, remainingMs: LOCKOUT_DURATION_MS };
  }

  return { locked: false, remainingMs: 0 };
}

/**
 * Checks if the account is currently locked out.
 */
export function isLockedOut(): { locked: boolean; remainingMs: number } {
  if (!session.lockoutUntil) return { locked: false, remainingMs: 0 };

  const remaining = session.lockoutUntil - Date.now();
  if (remaining <= 0) {
    session.lockoutUntil = null;
    session.passwordAttempts = 0;
    return { locked: false, remainingMs: 0 };
  }

  return { locked: true, remainingMs: remaining };
}

/**
 * Resets password attempts on successful unlock.
 */
export function resetPasswordAttempts(): void {
  session.passwordAttempts = 0;
  session.lockoutUntil = null;
}

/**
 * Records user activity to reset auto-lock timer.
 */
export function recordActivity(): void {
  if (session.isUnlocked) {
    session.lastActivity = Date.now();
    resetAutoLockTimer();
  }
}

/**
 * Sets the auto-lock duration.
 */
export function setAutoLockDuration(minutes: number): void {
  session.autoLockMs = minutes * 60 * 1000;
  resetAutoLockTimer();
}

// === Private Helpers ===

function resetAutoLockTimer(): void {
  clearAutoLockTimer();
  autoLockTimer = setTimeout(() => {
    lockSession();
    // Dispatch event for UI to react
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('grokie-wallet-locked'));
    }
  }, session.autoLockMs);
}

function clearAutoLockTimer(): void {
  if (autoLockTimer) {
    clearTimeout(autoLockTimer);
    autoLockTimer = null;
  }
}

function setupActivityListeners(): void {
  if (typeof window === 'undefined') return;

  const handler = () => recordActivity();
  const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];

  events.forEach((event) => {
    window.addEventListener(event, handler, { passive: true });
  });

  activityListeners = [handler];
}

function removeActivityListeners(): void {
  if (typeof window === 'undefined') return;

  const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
  activityListeners.forEach((handler) => {
    events.forEach((event) => {
      window.removeEventListener(event, handler);
    });
  });
  activityListeners = [];
}
