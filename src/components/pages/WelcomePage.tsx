'use client';

import { useState, useEffect } from 'react';
import { Logo } from '@/components/ui/Logo';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { useWalletContext } from '@/context/WalletContext';
import { checkCryptoSupport } from '@/lib/crypto';

export function WelcomePage() {
  const { setCurrentPage } = useWalletContext();
  const [cryptoWarning, setCryptoWarning] = useState('');

  useEffect(() => {
    const check = checkCryptoSupport();
    if (!check.supported) {
      setCryptoWarning(check.message);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-fade-in">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-grokie-orange/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-md">
        <Logo size="lg" />

        <h1 className="text-3xl font-bold mt-6 mb-3">
          Welcome to <span className="text-grokie-orange">GROKIE</span> Wallet
        </h1>

        <p className="text-gray-400 mb-8 leading-relaxed">
          A secure, non-custodial wallet for the Solana blockchain. Your keys, your crypto — always.
        </p>

        {cryptoWarning && (
          <div className="w-full mb-4">
            <WarningBanner
              type="danger"
              title="Secure Context Required"
              message={cryptoWarning}
            />
          </div>
        )}

        <div className="w-full space-y-4">
          <button
            onClick={() => setCurrentPage('create-wallet')}
            className="btn-primary w-full text-lg py-4"
            disabled={!!cryptoWarning}
          >
            Create New Wallet
          </button>

          <button
            onClick={() => setCurrentPage('import-wallet')}
            className="btn-secondary w-full text-lg py-4"
            disabled={!!cryptoWarning}
          >
            Import Existing Wallet
          </button>
        </div>

        <div className="mt-10 p-4 rounded-xl bg-grokie-dark-gray/50 border border-grokie-light-gray/50">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-grokie-orange" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-semibold text-grokie-orange">Fully Non-Custodial</span>
          </div>
          <p className="text-xs text-gray-500">
            Your private keys and seed phrases never leave your device. All encryption happens locally in your browser.
          </p>
        </div>
      </div>
    </div>
  );
}
