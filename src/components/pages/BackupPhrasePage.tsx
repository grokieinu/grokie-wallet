'use client';

import { useState } from 'react';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { useWalletContext } from '@/context/WalletContext';

export function BackupPhrasePage() {
  const { setCurrentPage, tempSeedPhrase, setTempSeedPhrase } = useWalletContext();
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const words = tempSeedPhrase?.split(' ') || [];

  const handleContinue = () => {
    // SECURITY: Clear seed phrase from memory after user confirms backup
    setTempSeedPhrase(null);
    setCurrentPage('dashboard');
  };

  const handleCopyAll = async () => {
    if (tempSeedPhrase) {
      await navigator.clipboard.writeText(tempSeedPhrase);
      setCopiedIndex(-1);
      // SECURITY: Clear clipboard after 60 seconds to prevent accidental exposure
      setTimeout(async () => {
        try {
          await navigator.clipboard.writeText('');
        } catch { /* clipboard access may be denied */ }
      }, 60000);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  if (!tempSeedPhrase) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-gray-400">No recovery phrase available.</p>
          <button onClick={() => setCurrentPage('dashboard')} className="btn-primary mt-4">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2">Backup Recovery Phrase</h1>
        <p className="text-gray-400 mb-6">
          Write down these words in order and store them in a safe place. This is the only way to recover your wallet.
        </p>

        <WarningBanner
          type="danger"
          title="Critical Security Warning"
          message="Never share your recovery phrase with anyone. Anyone with these words can steal your funds. GROKIE will never ask for your recovery phrase."
        />

        <div className="mt-6">
          {!isRevealed ? (
            <div className="card flex flex-col items-center py-10">
              <svg className="w-12 h-12 text-grokie-orange mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-gray-400 text-sm mb-4 text-center">
                Make sure no one is watching your screen before revealing your recovery phrase.
              </p>
              <button onClick={() => setIsRevealed(true)} className="btn-primary">
                Reveal Recovery Phrase
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {words.map((word, index) => (
                  <div
                    key={index}
                    className="bg-grokie-mid-gray border border-grokie-light-gray rounded-lg px-3 py-2 text-center"
                  >
                    <span className="text-xs text-gray-500">{index + 1}.</span>{' '}
                    <span className="text-sm font-medium">{word}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleCopyAll}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                {copiedIndex === -1 ? (
                  <>
                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy All Words
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {isRevealed && (
          <div className="mt-6 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasConfirmed}
                onChange={(e) => setHasConfirmed(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-grokie-light-gray bg-grokie-mid-gray text-grokie-orange focus:ring-grokie-orange"
              />
              <span className="text-sm text-gray-300">
                I have written down my recovery phrase and stored it in a safe place. I understand that if I lose it, I will lose access to my wallet permanently.
              </span>
            </label>

            <button
              onClick={handleContinue}
              disabled={!hasConfirmed}
              className="btn-primary w-full"
            >
              Continue to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
