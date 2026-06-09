'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useWalletContext } from '@/context/WalletContext';
import { Toast } from '@/components/ui/Toast';

export function ReceivePage() {
  const { wallet, setCurrentPage } = useWalletContext();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handleCopyAddress = async () => {
    if (wallet) {
      await navigator.clipboard.writeText(wallet.publicKey);
      setToast({ message: 'Address copied to clipboard', type: 'success' });
    }
  };

  if (!wallet) return null;

  return (
    <div className="min-h-screen flex flex-col p-6 animate-fade-in">
      <div className="w-full max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setCurrentPage('dashboard')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">Receive</h1>
        </div>

        <div className="card flex flex-col items-center text-center">
          {/* Info badge */}
          <div className="bg-grokie-orange/10 border border-grokie-orange/30 rounded-lg px-3 py-2 mb-4">
            <p className="text-xs text-grokie-orange font-medium">
              ✓ This address works for SOL and ALL SPL tokens
            </p>
          </div>

          <p className="text-sm text-gray-400 mb-4">
            Share your address or scan the QR code to receive any Solana token.
          </p>

          {/* QR Code */}
          <div className="bg-white p-4 rounded-xl mb-6">
            <QRCodeSVG
              value={wallet.publicKey}
              size={200}
              level="H"
              includeMargin={false}
              fgColor="#0A0A0A"
              bgColor="#FFFFFF"
            />
          </div>

          {/* Address */}
          <div className="w-full bg-grokie-mid-gray rounded-xl p-4 mb-4">
            <p className="text-xs text-gray-400 mb-1">Your Wallet Address</p>
            <p className="text-sm font-mono break-all text-gray-200 select-all">{wallet.publicKey}</p>
          </div>

          {/* Copy Button */}
          <button onClick={handleCopyAddress} className="btn-primary w-full flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy Address
          </button>

          {/* Supported tokens info */}
          <div className="mt-6 w-full border-t border-grokie-light-gray pt-4">
            <p className="text-xs font-semibold text-gray-300 mb-2">You can receive:</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                SOL (Solana)
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                USDC, USDT
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                All SPL Tokens
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-grokie-orange" />
                Token-2022
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Only send Solana-based assets to this address. Sending tokens from other blockchains (Ethereum, BNB Chain, etc.) will result in permanent loss.
          </p>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
