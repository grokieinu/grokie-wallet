'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useWalletContext } from '@/context/WalletContext';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Toast } from '@/components/ui/Toast';
import { generateTOTPSecret, verifyTOTP, encryptTOTPSecret } from '@/lib/two-factor';
import { getWallet, saveWallet } from '@/lib/storage';
import { hashPassword, hexToBuffer } from '@/lib/crypto';

type TwoFactorStep = 'overview' | 'setup' | 'verify' | 'disable';

export function TwoFactorPage() {
  const { wallet, setCurrentPage, refreshWallet } = useWalletContext();
  const [step, setStep] = useState<TwoFactorStep>('overview');
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [secret, setSecret] = useState('');
  const [uri, setUri] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (wallet) {
      setIs2FAEnabled(!!wallet.twoFactorEnabled);
    }
  }, [wallet]);

  // Generate new TOTP secret for setup
  const handleStartSetup = () => {
    if (!wallet) return;
    const setup = generateTOTPSecret(wallet.publicKey.slice(0, 8));
    setSecret(setup.secret);
    setUri(setup.uri);
    setStep('setup');
  };

  // Verify code and enable 2FA
  const handleVerifyAndEnable = async () => {
    if (!wallet || !password) {
      setError('Please enter your password.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      // Verify password first
      const walletRecord = await getWallet(wallet.id);
      if (!walletRecord) throw new Error('Wallet not found.');

      const salt = hexToBuffer(walletRecord.passwordSalt);
      const computedHash = await hashPassword(password, salt);
      if (computedHash !== walletRecord.passwordHash) {
        setError('Incorrect password.');
        setIsLoading(false);
        return;
      }

      // Verify TOTP code
      if (!verifyTOTP(secret, verifyCode)) {
        setError('Invalid 2FA code. Please check your authenticator app and try again.');
        setIsLoading(false);
        return;
      }

      // Encrypt and save TOTP secret
      const encryptedSecret = await encryptTOTPSecret(secret, password);
      walletRecord.twoFactorEnabled = true;
      walletRecord.encryptedTOTPSecret = encryptedSecret;
      await saveWallet(walletRecord);
      await refreshWallet();

      setIs2FAEnabled(true);
      setStep('overview');
      setSecret('');
      setUri('');
      setPassword('');
      setVerifyCode('');
      setToast({ message: '2FA enabled successfully!', type: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable 2FA.');
    } finally {
      setIsLoading(false);
    }
  };

  // Disable 2FA
  const handleDisable = async () => {
    if (!wallet || !password || !verifyCode) {
      setError('Please enter your password and 2FA code.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const walletRecord = await getWallet(wallet.id);
      if (!walletRecord) throw new Error('Wallet not found.');

      // Verify password
      const salt = hexToBuffer(walletRecord.passwordSalt);
      const computedHash = await hashPassword(password, salt);
      if (computedHash !== walletRecord.passwordHash) {
        setError('Incorrect password.');
        setIsLoading(false);
        return;
      }

      // Decrypt and verify TOTP
      if (!walletRecord.encryptedTOTPSecret) {
        throw new Error('2FA data not found.');
      }

      const { decryptTOTPSecret } = await import('@/lib/two-factor');
      const totpSecret = await decryptTOTPSecret(walletRecord.encryptedTOTPSecret, password);

      if (!verifyTOTP(totpSecret, verifyCode)) {
        setError('Invalid 2FA code.');
        setIsLoading(false);
        return;
      }

      // Disable 2FA
      walletRecord.twoFactorEnabled = false;
      walletRecord.encryptedTOTPSecret = undefined;
      await saveWallet(walletRecord);
      await refreshWallet();

      setIs2FAEnabled(false);
      setStep('overview');
      setPassword('');
      setVerifyCode('');
      setToast({ message: '2FA disabled.', type: 'info' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable 2FA.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!wallet) return null;

  return (
    <div className="min-h-screen flex flex-col p-6 animate-fade-in">
      <div className="w-full max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => step === 'overview' ? setCurrentPage('settings') : setStep('overview')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">Two-Factor Authentication</h1>
        </div>

        {/* Overview */}
        {step === 'overview' && (
          <div className="space-y-4">
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">2FA Status</h3>
                <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                  is2FAEnabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {is2FAEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="text-sm text-gray-400">
                {is2FAEnabled
                  ? 'Your wallet is protected with an additional layer of security. You will need your authenticator app when unlocking or performing sensitive operations.'
                  : 'Add an extra layer of security by requiring a code from your authenticator app (Google Authenticator, Authy, etc.) when unlocking your wallet.'}
              </p>
            </div>

            {!is2FAEnabled ? (
              <button onClick={handleStartSetup} className="btn-primary w-full">
                Enable 2FA
              </button>
            ) : (
              <button onClick={() => setStep('disable')} className="btn-danger w-full">
                Disable 2FA
              </button>
            )}

            <WarningBanner
              type="info"
              title="How it works"
              message="After enabling 2FA, you'll need to enter a 6-digit code from your authenticator app every time you unlock your wallet or export sensitive data."
            />
          </div>
        )}

        {/* Setup - Show QR code */}
        {step === 'setup' && (
          <div className="space-y-4">
            <WarningBanner
              type="warning"
              title="Save Your Backup Code"
              message="If you lose access to your authenticator app, you will need to disable 2FA using your password. Save the secret key below as backup."
            />

            <div className="card text-center">
              <p className="text-sm text-gray-400 mb-4">
                Scan this QR code with your authenticator app:
              </p>
              <div className="bg-white p-4 rounded-xl inline-block mx-auto mb-4">
                <QRCodeSVG value={uri} size={180} level="M" />
              </div>
              <div className="bg-grokie-mid-gray rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Or enter this key manually:</p>
                <p className="text-sm font-mono break-all text-grokie-orange select-all">{secret}</p>
              </div>
            </div>

            <button onClick={() => setStep('verify')} className="btn-primary w-full">
              Next: Verify Code
            </button>
          </div>
        )}

        {/* Verify - Enter code to confirm setup */}
        {step === 'verify' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Enter the 6-digit code from your authenticator app and your wallet password to enable 2FA.
            </p>

            <div>
              <label className="input-label">6-Digit Code</label>
              <input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input-field text-center text-2xl tracking-widest font-mono"
                placeholder="000000"
                maxLength={6}
                autoFocus
              />
            </div>

            <div>
              <label className="input-label">Wallet Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-900/20 p-3 rounded-lg">{error}</p>
            )}

            <button
              onClick={handleVerifyAndEnable}
              disabled={isLoading || verifyCode.length !== 6 || !password}
              className="btn-primary w-full"
            >
              {isLoading ? <LoadingSpinner size="sm" /> : 'Enable 2FA'}
            </button>
          </div>
        )}

        {/* Disable 2FA */}
        {step === 'disable' && (
          <div className="space-y-4">
            <WarningBanner
              type="danger"
              title="Disable 2FA"
              message="This will remove the additional security layer from your wallet. You'll need your current 2FA code and password."
            />

            <div>
              <label className="input-label">6-Digit 2FA Code</label>
              <input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input-field text-center text-2xl tracking-widest font-mono"
                placeholder="000000"
                maxLength={6}
                autoFocus
              />
            </div>

            <div>
              <label className="input-label">Wallet Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-900/20 p-3 rounded-lg">{error}</p>
            )}

            <button
              onClick={handleDisable}
              disabled={isLoading || verifyCode.length !== 6 || !password}
              className="btn-danger w-full"
            >
              {isLoading ? <LoadingSpinner size="sm" /> : 'Disable 2FA'}
            </button>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
