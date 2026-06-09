'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWalletContext } from '@/context/WalletContext';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { TokenIcon } from '@/components/ui/TokenIcon';
import { Toast } from '@/components/ui/Toast';
import {
  sendSOL,
  sendSPLToken,
  isValidSolanaAddress,
  getExplorerUrl,
  getSOLBalance,
  getSPLTokenBalances,
  type TokenBalance,
} from '@/lib/solana';
import { getActivePrivateKey } from '@/lib/wallet-manager';
import { saveTransaction, type TransactionRecord } from '@/lib/storage';

type SendStep = 'form' | 'confirm' | 'result';

interface SendableToken {
  type: 'SOL' | 'SPL';
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
  logoURI?: string;
}

export function SendPage() {
  const { wallet, setCurrentPage, rpcEndpoint } = useWalletContext();
  const [step, setStep] = useState<SendStep>('form');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [txSignature, setTxSignature] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Token selection
  const [tokens, setTokens] = useState<SendableToken[]>([]);
  const [selectedToken, setSelectedToken] = useState<SendableToken | null>(null);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const [showTokenPicker, setShowTokenPicker] = useState(false);

  // Load all tokens with balance
  const fetchTokens = useCallback(async () => {
    if (!wallet) return;
    setIsLoadingTokens(true);
    try {
      const [solBalance, splTokens] = await Promise.all([
        getSOLBalance(wallet.publicKey, rpcEndpoint).catch(() => 0),
        getSPLTokenBalances(wallet.publicKey, rpcEndpoint).catch(() => []),
      ]);

      const tokenList: SendableToken[] = [];

      // Add SOL if has balance
      if (solBalance > 0) {
        tokenList.push({
          type: 'SOL',
          mint: 'So11111111111111111111111111111111111111112',
          symbol: 'SOL',
          name: 'Solana',
          balance: solBalance,
          decimals: 9,
          logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
        });
      }

      // Add SPL tokens with balance > 0
      splTokens
        .filter((t) => t.balance > 0)
        .forEach((t) => {
          tokenList.push({
            type: 'SPL',
            mint: t.mint,
            symbol: t.symbol || `${t.mint.slice(0, 4)}...`,
            name: t.name || 'Unknown Token',
            balance: t.balance,
            decimals: t.decimals,
            logoURI: t.logoURI,
          });
        });

      setTokens(tokenList);

      // Default select SOL if available
      if (tokenList.length > 0) {
        setSelectedToken(tokenList[0]);
      }
    } catch {
      setTokens([]);
    } finally {
      setIsLoadingTokens(false);
    }
  }, [wallet, rpcEndpoint]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const validateForm = (): boolean => {
    setError('');

    if (!selectedToken) {
      setError('Please select a token to send.');
      return false;
    }

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

    if (amountNum > selectedToken.balance) {
      setError(`Insufficient ${selectedToken.symbol} balance.`);
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
    if (!wallet || !selectedToken) return;

    const privateKey = getActivePrivateKey();
    if (!privateKey) {
      setError('Session expired. Please unlock your wallet again.');
      return;
    }

    setIsSending(true);
    setError('');

    try {
      let result;

      if (selectedToken.type === 'SOL') {
        result = await sendSOL(privateKey, toAddress.trim(), parseFloat(amount), rpcEndpoint);
      } else {
        result = await sendSPLToken(
          privateKey,
          toAddress.trim(),
          selectedToken.mint,
          parseFloat(amount),
          selectedToken.decimals,
          rpcEndpoint
        );
      }

      if (result.success) {
        setTxSignature(result.signature);

        // Save transaction record
        const txRecord: TransactionRecord = {
          id: crypto.randomUUID(),
          walletId: wallet.id,
          signature: result.signature,
          type: 'send',
          amount: parseFloat(amount),
          token: selectedToken.symbol,
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

  const handleMaxAmount = () => {
    if (!selectedToken) return;
    if (selectedToken.type === 'SOL') {
      // Reserve some SOL for transaction fee
      setAmount(Math.max(0, selectedToken.balance - 0.005).toFixed(6));
    } else {
      setAmount(selectedToken.balance.toString());
    }
  };

  const renderTokenPicker = () => (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center animate-fade-in">
      <div className="bg-grokie-dark-gray w-full max-w-md rounded-2xl p-6 max-h-[70vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Select Token</h3>
          <button
            onClick={() => setShowTokenPicker(false)}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {tokens.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No tokens with balance found.</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((token) => (
              <button
                key={token.mint}
                onClick={() => {
                  setSelectedToken(token);
                  setAmount('');
                  setShowTokenPicker(false);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                  selectedToken?.mint === token.mint
                    ? 'bg-grokie-orange/20 border border-grokie-orange/50'
                    : 'bg-grokie-gray hover:bg-grokie-light-gray'
                }`}
              >
                <div className="flex items-center gap-3">
                  <TokenIcon logoUrl={token.logoURI} symbol={token.symbol} />
                  <div className="text-left">
                    <p className="font-medium text-sm">{token.name}</p>
                    <p className="text-xs text-gray-400">{token.symbol}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">
                    {token.balance < 0.0001 ? token.balance.toExponential(2) : token.balance.toFixed(4)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderForm = () => (
    <div className="space-y-4">
      {/* Token Selector */}
      <div>
        <label className="input-label">Token</label>
        {isLoadingTokens ? (
          <div className="input-field flex items-center justify-center py-3">
            <LoadingSpinner size="sm" text="Loading tokens..." />
          </div>
        ) : (
          <button
            onClick={() => setShowTokenPicker(true)}
            className="input-field w-full flex items-center justify-between cursor-pointer hover:border-grokie-orange/50 transition-colors"
          >
            {selectedToken ? (
              <div className="flex items-center gap-3">
                <TokenIcon logoUrl={selectedToken.logoURI} symbol={selectedToken.symbol} />
                <div className="text-left">
                  <p className="font-medium text-sm">{selectedToken.symbol}</p>
                  <p className="text-xs text-gray-400">
                    Balance: {selectedToken.balance < 0.0001 ? selectedToken.balance.toExponential(2) : selectedToken.balance.toFixed(4)}
                  </p>
                </div>
              </div>
            ) : (
              <span className="text-gray-400">Select a token</span>
            )}
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Recipient Address */}
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

      {/* Amount */}
      <div>
        <label className="input-label">
          Amount {selectedToken ? `(${selectedToken.symbol})` : ''}
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input-field pr-16"
            placeholder="0.00"
            step="any"
            min="0"
          />
          {selectedToken && (
            <button
              onClick={handleMaxAmount}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-grokie-orange hover:text-grokie-orange-light font-medium"
            >
              MAX
            </button>
          )}
        </div>
        {selectedToken && (
          <p className="text-xs text-gray-500 mt-1">
            Available: {selectedToken.balance < 0.0001 ? selectedToken.balance.toExponential(2) : selectedToken.balance.toFixed(4)} {selectedToken.symbol}
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 p-3 rounded-lg">{error}</p>
      )}

      <button
        onClick={handleReview}
        className="btn-primary w-full"
        disabled={!selectedToken || isLoadingTokens}
      >
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
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Token</span>
          <div className="flex items-center gap-2">
            <TokenIcon logoUrl={selectedToken?.logoURI} symbol={selectedToken?.symbol || ''} />
            <span className="text-sm font-semibold">{selectedToken?.symbol}</span>
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-400">To</span>
          <span className="text-sm font-mono text-right max-w-[200px] truncate">{toAddress}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-400">Amount</span>
          <span className="text-sm font-semibold">{amount} {selectedToken?.symbol}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-400">Network Fee</span>
          <span className="text-sm text-gray-300">~0.000005 SOL</span>
        </div>
        <div className="border-t border-grokie-light-gray my-2" />
        <div className="flex justify-between">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-sm font-semibold text-grokie-orange">
            {amount} {selectedToken?.symbol}
            {selectedToken?.type === 'SOL' && ' + fee'}
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
      <p className="text-gray-400 text-sm">
        {amount} {selectedToken?.symbol} has been sent successfully.
      </p>

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
          <h1 className="text-xl font-bold">Send</h1>
        </div>

        {step === 'form' && renderForm()}
        {step === 'confirm' && renderConfirm()}
        {step === 'result' && renderResult()}
      </div>

      {showTokenPicker && renderTokenPicker()}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
