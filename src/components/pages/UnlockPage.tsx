'use client';

import { useState } from 'react';
import { Logo } from '@/components/ui/Logo';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useWalletContext } from '@/context/WalletContext';
import { unlockWallet, is2FAEnabled } from '@/lib/wallet-manager';

export function UnlockPage() {
  const { wallet, setIsUnlocked, setCurrentPage } = useWalletContext();
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState('');

  const handleUnlock = async () => {
    if (!wallet || !password) return;

    setError('');
    setIsUnlocking(true);

    try {
      await unlockWallet(wallet.id, password, totpCode || undefined);
      setPassword('');
      setTotpCode('');
      setIsUnlocked(true);
      setCurrentPage('dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unlock wallet.';
      // If 2FA is required, show 2FA input
      if (message === '2FA_REQUIRED') {
        setNeeds2FA(true);
        setError('');
      } else {
        setError(message);
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  // Check 2FA status on first render
  useState(() => {
    if (wallet) {
      is2FAEnabled(wallet.id).then((enabled) => {
        if (enabled) setNeeds2FA(true);
      });
    }
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleUnlock();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-sm text-center">
        <Logo size="lg" />

        <h1 className="text-2xl font-bold mt-6 mb-2">Welcome Back</h1>
        <p className="text-gray-400 mb-8">
          {needs2FA ? 'Enter your password and 2FA code to unlock.' : 'Enter your password to unlock your wallet.'}
        </p>

        <div className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            className="input-field text-center"
            placeholder="Enter your password"
            autoFocus
          />

          {needs2FA && (
            <div>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={handleKeyDown}
                className="input-field text-center text-xl tracking-widest font-mono"
                placeholder="2FA Code"
                maxLength={6}
              />
              <p className="text-xs text-gray-500 mt-1">Enter 6-digit code from your authenticator app</p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 p-3 rounded-lg">{error}</p>
          )}

          <button
            onClick={handleUnlock}
            disabled={!password || isUnlocking || (needs2FA && totpCode.length !== 6)}
            className="btn-primary w-full"
          >
            {isUnlocking ? <LoadingSpinner size="sm" /> : 'Unlock'}
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-8">
          Forgot password? You can restore your wallet using your recovery phrase.
        </p>
      </div>
    </div>
  );
}
