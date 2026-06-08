'use client';

import { useState } from 'react';
import { Logo } from '@/components/ui/Logo';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useWalletContext } from '@/context/WalletContext';
import { createWallet } from '@/lib/wallet-manager';

export function CreateWalletPage() {
  const { setCurrentPage, setWallet, setIsUnlocked, setTempSeedPhrase } = useWalletContext();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [walletName, setWalletName] = useState('My Wallet');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isPasswordStrong = password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password);

  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleCreate = async () => {
    setError('');

    // Check crypto availability first
    const { checkCryptoSupport } = await import('@/lib/crypto');
    const cryptoCheck = checkCryptoSupport();
    if (!cryptoCheck.supported) {
      setError(cryptoCheck.message);
      return;
    }

    if (!isPasswordStrong) {
      setError('Password must be at least 8 characters with uppercase, lowercase, and numbers.');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setIsCreating(true);
    try {
      const result = await createWallet(password, walletName);

      // SECURITY: Store seed phrase temporarily for backup display
      setTempSeedPhrase(result.seedPhrase);

      // Clear password from state
      setPassword('');
      setConfirmPassword('');

      // Update context
      const { getAllWallets } = await import('@/lib/storage');
      const wallets = await getAllWallets();
      setWallet(wallets[0]);
      setIsUnlocked(true);

      // Navigate to backup page
      setCurrentPage('backup-phrase');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create wallet.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-md">
        <button
          onClick={() => setCurrentPage('welcome')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <Logo size="sm" />
        <h1 className="text-2xl font-bold mt-4 mb-2">Create New Wallet</h1>
        <p className="text-gray-400 mb-6">
          Set up a password to encrypt your wallet. This password will be used to lock and unlock your wallet.
        </p>

        <div className="space-y-4">
          <div>
            <label className="input-label">Wallet Name</label>
            <input
              type="text"
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
              className="input-field"
              placeholder="My Wallet"
              maxLength={30}
            />
          </div>

          <div>
            <label className="input-label">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pr-12"
                placeholder="Enter a strong password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Password strength indicator */}
            {password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  <div className={`h-1 flex-1 rounded ${password.length >= 8 ? 'bg-green-500' : 'bg-gray-600'}`} />
                  <div className={`h-1 flex-1 rounded ${/[A-Z]/.test(password) ? 'bg-green-500' : 'bg-gray-600'}`} />
                  <div className={`h-1 flex-1 rounded ${/[a-z]/.test(password) ? 'bg-green-500' : 'bg-gray-600'}`} />
                  <div className={`h-1 flex-1 rounded ${/[0-9]/.test(password) ? 'bg-green-500' : 'bg-gray-600'}`} />
                </div>
                <p className="text-xs text-gray-500">
                  Min 8 chars, uppercase, lowercase, and number required
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="input-label">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-field"
              placeholder="Confirm your password"
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 p-3 rounded-lg">{error}</p>
          )}

          <WarningBanner
            type="info"
            title="Remember Your Password"
            message="Your password cannot be recovered. If you forget it, you will need your recovery phrase to restore your wallet."
          />

          <button
            onClick={handleCreate}
            disabled={!isPasswordStrong || !passwordsMatch || isCreating}
            className="btn-primary w-full mt-4"
          >
            {isCreating ? <LoadingSpinner size="sm" /> : 'Create Wallet'}
          </button>
        </div>
      </div>
    </div>
  );
}
