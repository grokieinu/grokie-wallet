'use client';

import { useState } from 'react';
import { Logo } from '@/components/ui/Logo';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useWalletContext } from '@/context/WalletContext';
import { importWalletFromSeed, importWalletFromKey } from '@/lib/wallet-manager';

type ImportMethod = 'seed' | 'key';

export function ImportWalletPage() {
  const { setCurrentPage, setWallet, setIsUnlocked } = useWalletContext();
  const [method, setMethod] = useState<ImportMethod>('seed');
  const [seedPhrase, setSeedPhrase] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [walletName, setWalletName] = useState('Imported Wallet');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isPasswordStrong = password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password);

  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleImport = async () => {
    setError('');

    if (!isPasswordStrong) {
      setError('Password must be at least 8 characters with uppercase, lowercase, and numbers.');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    if (method === 'seed' && !seedPhrase.trim()) {
      setError('Please enter your seed phrase.');
      return;
    }

    if (method === 'key' && !privateKey.trim()) {
      setError('Please enter your private key.');
      return;
    }

    setIsImporting(true);
    try {
      if (method === 'seed') {
        await importWalletFromSeed(seedPhrase.trim().toLowerCase(), password, walletName);
      } else {
        await importWalletFromKey(privateKey.trim(), password, walletName);
      }

      // SECURITY: Clear sensitive input from state
      setSeedPhrase('');
      setPrivateKey('');
      setPassword('');
      setConfirmPassword('');

      // Update context
      const { getAllWallets } = await import('@/lib/storage');
      const wallets = await getAllWallets();
      setWallet(wallets[0]);
      setIsUnlocked(true);
      setCurrentPage('dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import wallet.');
    } finally {
      setIsImporting(false);
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
        <h1 className="text-2xl font-bold mt-4 mb-2">Import Wallet</h1>
        <p className="text-gray-400 mb-6">
          Restore your wallet using a seed phrase or private key.
        </p>

        {/* Import method tabs */}
        <div className="flex bg-grokie-mid-gray rounded-xl p-1 mb-6">
          <button
            onClick={() => setMethod('seed')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              method === 'seed' ? 'bg-grokie-orange text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Seed Phrase
          </button>
          <button
            onClick={() => setMethod('key')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              method === 'key' ? 'bg-grokie-orange text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Private Key
          </button>
        </div>

        <div className="space-y-4">
          <WarningBanner
            type="danger"
            title="Anti-Phishing Warning"
            message="Never enter your seed phrase or private key on any website you don't trust. GROKIE Wallet will NEVER ask for your keys outside of this app."
          />

          {method === 'seed' ? (
            <div>
              <label className="input-label">Recovery Seed Phrase</label>
              <textarea
                value={seedPhrase}
                onChange={(e) => setSeedPhrase(e.target.value)}
                className="input-field h-28 resize-none"
                placeholder="Enter your 12 or 24 word recovery phrase separated by spaces"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          ) : (
            <div>
              <label className="input-label">Private Key (Base58)</label>
              <textarea
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                className="input-field h-20 resize-none font-mono text-sm"
                placeholder="Enter your Base58 encoded private key"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}

          <div>
            <label className="input-label">Wallet Name</label>
            <input
              type="text"
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
              className="input-field"
              placeholder="Imported Wallet"
              maxLength={30}
            />
          </div>

          <div>
            <label className="input-label">New Password</label>
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
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
            {password.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1">
                  <div className={`h-1 flex-1 rounded ${password.length >= 8 ? 'bg-green-500' : 'bg-gray-600'}`} />
                  <div className={`h-1 flex-1 rounded ${/[A-Z]/.test(password) ? 'bg-green-500' : 'bg-gray-600'}`} />
                  <div className={`h-1 flex-1 rounded ${/[a-z]/.test(password) ? 'bg-green-500' : 'bg-gray-600'}`} />
                  <div className={`h-1 flex-1 rounded ${/[0-9]/.test(password) ? 'bg-green-500' : 'bg-gray-600'}`} />
                </div>
                <p className="text-xs text-gray-500 mt-1">Min 8 chars, uppercase, lowercase, number</p>
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

          <button
            onClick={handleImport}
            disabled={!isPasswordStrong || !passwordsMatch || isImporting}
            className="btn-primary w-full mt-4"
          >
            {isImporting ? <LoadingSpinner size="sm" /> : 'Import Wallet'}
          </button>
        </div>
      </div>
    </div>
  );
}
