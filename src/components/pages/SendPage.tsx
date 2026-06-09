'use client';

import { useState } from 'react';
import { useWalletContext } from '@/context/WalletContext';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Toast } from '@/components/ui/Toast';
import { sendSOL, isValidSolanaAddress, getExplorerUrl, getSOLBalance } from '@/lib/solana';
import { getActivePrivateKey } from '@/lib/wallet-manager';
import { saveTransaction, type TransactionRecord } from '@/lib/storage';

type SendStep = 'form' | 'confirm' | 'result';

export function SendPage() {
  const { wallet, setCurrentPage, rpcEndpoint } = useWalletContext();
  const [step, setStep] = useState<SendStep>('form');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [txSignature, setTxSignature] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  // Load balance on mount
  useState(() => {
    if (wallet) {
      getSOLBalance(wallet.publicKey, rpcEndpoint).then(setBalance).catch(() => {});
    }
  });

  const validateForm = (): boolean => {
    setError('');

    if (!toAddress.trim()) {
      setError('Please enter a recipient address.');
      return false;
    }

    if (!isValidSolanaAddress(toAddress.trim())) {
      setError('Invalid Solana address. Please check and try again.');
      return false;
    }

    if (wallet && toAddress.trim() === wallet.publicKey) {
      setError('Cannot send to your own address.');
      return false;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return false;
    }

    if (balance !== null && amountNum > balance) {
      setError('Insufficient balance.');
      return false;
    }

    return true;
  };

  const handleReview = () => {
    if (validateForm()) {
      setStep('confirm');
    }
  };

  const handleSend = async () => {
    if (!wallet) return;

    const privateKey = getActivePrivateKey();
    if (!privateKey) {
      setError('Session expired. Please unlock your wallet again.');
      return;
    }

    setIsSending(true);
    setError('');

    try {
      const result = await sendSOL(privateKey, toAddress.trim(), parseFloat(amount), rpcEndpoint);

      if (result.success) {
        setTxSignature(result.signature);

        // Save transaction record
        const txRecord: TransactionRecord = {
          id: crypto.randomUUID(),
          walletId: wallet.id,
          signature: result.signature,
          type: 'send',
          amount: parseFloat(amount),
          token: 'SOL',
          to: toAddress.trim(),
          from: wallet.publicKey,
          timestamp: Date.now(),
          status: 'confirmed',
        };
        await saveTransaction(txRecord);

        setStep('result');
      } else {
        setError(result.error || 'Transaction failed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed.');
    } finally {
      setIsSending(false);
    }
  };

  const renderForm = () => (
    <div className="space-y-4">
      <div>
        <label className="input-label">Recipient Address</label>
        <input
          type="text"
          value={toAddress}
          onChange={(e) => setToAddress(e.target.value)}
          className="input-field font-mono text-sm"
          placeholder="Enter Solana address"
          spellCheck={false}
        />
      </div>

      <div>
        <label className="input-label">Amount (SOL)</label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input-field pr-16"
            placeholder="0.00"
            step="0.001"
            min="0"
          />
          {balance !== null && (
            <button
              onClick={() => setAmount(Math.max(0, balance - 0.001).toFixed(4))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-grokie-orange hover:text-grokie-orange-light font-medium"
            >
              MAX
            </button>
          )}
        </div>
        {balance !== null && (
          <p className="text-xs text-gray-500 mt-1">Available: {balance.toFixed(4)} SOL</p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 p-3 rounded-lg">{error}</p>
      )}

      <button onClick={handleReview} className="btn-primary w-full">
        Review Transaction
      </button>
    </div>
  );

  const renderConfirm = () => (
    <div className="space-y-4">
      <WarningBanner
        type="warning"
        title="Confirm Transaction"
        message="Please review the details below. Transactions on Solana are irreversible."
      />

      <div className="card space-y-3">
        <div className="flex justify-between">
          <span className="text-sm text-gray-400">To</span>
          <span className="text-sm font-mono text-right max-w-[200px] truncate">{toAddress}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-400">Amount</span>
          <span className="text-sm font-semibold">{amount} SOL</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-400">Network Fee</span>
          <span className="text-sm text-gray-300">~0.000005 SOL</span>
        </div>
        <div className="border-t border-grokie-light-gray my-2" />
        <div className="flex justify-between">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-sm font-semibold text-grokie-orange">
            {(parseFloat(amount) + 0.000005).toFixed(6)} SOL
          </span>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 p-3 rounded-lg">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setStep('form')} className="btn-secondary" disabled={isSending}>
          Cancel
        </button>
        <button onClick={handleSend} className="btn-primary" disabled={isSending}>
          {isSending ? <LoadingSpinner size="sm" /> : 'Confirm & Send'}
        </button>
      </div>
    </div>
  );

  const renderResult = () => (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-xl font-bold">Transaction Sent!</h2>
      <p className="text-gray-400 text-sm">Your transaction has been submitted to the Solana network.</p>

      <div className="card text-left">
        <p className="text-xs text-gray-400 mb-1">Transaction Signature</p>
        <p className="text-xs font-mono break-all text-gray-300">{txSignature}</p>
      </div>

      <a
        href={getExplorerUrl(txSignature)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary w-full inline-flex items-center justify-center gap-2"
      >
        View on Solana Explorer
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>

      <button onClick={() => setCurrentPage('dashboard')} className="btn-primary w-full">
        Back to Dashboard
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col p-6 animate-fade-in">
      <div className="w-full max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => step === 'form' ? setCurrentPage('dashboard') : setStep('form')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">Send SOL</h1>
        </div>

        {step === 'form' && renderForm()}
        {step === 'confirm' && renderConfirm()}
        {step === 'result' && renderResult()}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
