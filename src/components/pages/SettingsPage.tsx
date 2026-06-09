'use client';

import { useState } from 'react';
import { useWalletContext } from '@/context/WalletContext';
import { Modal } from '@/components/ui/Modal';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Toast } from '@/components/ui/Toast';
import {
  changePassword,
  exportPrivateKey,
  exportSeedPhrase,
  deleteWalletPermanently,
  lockCurrentWallet,
} from '@/lib/wallet-manager';

type SettingsModal = 'none' | 'change-password' | 'export-key' | 'export-phrase' | 'delete-wallet';

export function SettingsPage() {
  const { wallet, setCurrentPage, lockWallet, refreshWallet } = useWalletContext();
  const [activeModal, setActiveModal] = useState<SettingsModal>('none');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Export State
  const [exportPassword, setExportPassword] = useState('');
  const [exportedData, setExportedData] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Delete State
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // RPC State - no longer editable by user

  const [error, setError] = useState('');

  const resetModals = () => {
    setActiveModal('none');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setExportPassword('');
    setExportedData('');
    setDeletePassword('');
    setDeleteConfirmText('');
    setError('');
  };

  const handleChangePassword = async () => {
    if (!wallet) return;
    setError('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(wallet.id, currentPassword, newPassword);
      setToast({ message: 'Password changed successfully', type: 'success' });
      resetModals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleExportKey = async () => {
    if (!wallet) return;
    setError('');
    setIsExporting(true);
    try {
      const key = await exportPrivateKey(wallet.id, exportPassword);
      setExportedData(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export private key.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPhrase = async () => {
    if (!wallet) return;
    setError('');
    setIsExporting(true);
    try {
      const phrase = await exportSeedPhrase(wallet.id, exportPassword);
      setExportedData(phrase);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export recovery phrase.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteWallet = async () => {
    if (!wallet) return;
    setError('');

    if (deleteConfirmText !== 'DELETE') {
      setError('Please type DELETE to confirm.');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteWalletPermanently(wallet.id, deletePassword);
      await refreshWallet();
      resetModals();
      setCurrentPage('welcome');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete wallet.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyExported = async () => {
    await navigator.clipboard.writeText(exportedData);
    setToast({ message: 'Copied to clipboard (auto-clears in 60s)', type: 'success' });
    // SECURITY: Clear clipboard after 60 seconds
    setTimeout(async () => {
      try {
        await navigator.clipboard.writeText('');
      } catch { /* clipboard access may be denied */ }
    }, 60000);
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
          <h1 className="text-xl font-bold">Settings</h1>
        </div>

        <div className="space-y-3">
          {/* Network Settings */}
          <div className="card">
            <h3 className="font-semibold mb-3">Network</h3>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">RPC Endpoint</span>
              <span className="text-sm text-green-400 font-medium">Connected (Helius)</span>
            </div>
          </div>

          {/* Security Settings */}
          <div className="card">
            <h3 className="font-semibold mb-3">Security</h3>
            <div className="space-y-2">
              <button
                onClick={() => setActiveModal('change-password')}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-grokie-mid-gray transition-colors"
              >
                <span className="text-sm">Change Password</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={() => setCurrentPage('two-factor')}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-grokie-mid-gray transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">Two-Factor Auth (2FA)</span>
                  {wallet.twoFactorEnabled && (
                    <span className="px-1.5 py-0.5 rounded text-xs bg-green-500/20 text-green-400">ON</span>
                  )}
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={() => setActiveModal('export-key')}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-grokie-mid-gray transition-colors"
              >
                <span className="text-sm">Export Private Key</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={() => setActiveModal('export-phrase')}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-grokie-mid-gray transition-colors"
              >
                <span className="text-sm">Export Recovery Phrase</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={lockWallet}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-grokie-mid-gray transition-colors"
              >
                <span className="text-sm">Lock Wallet</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="card border-red-900/50">
            <h3 className="font-semibold text-red-400 mb-3">Danger Zone</h3>
            <button
              onClick={() => setActiveModal('delete-wallet')}
              className="btn-danger w-full text-sm"
            >
              Delete Wallet
            </button>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal isOpen={activeModal === 'change-password'} onClose={resetModals} title="Change Password">
        <div className="space-y-4">
          <div>
            <label className="input-label">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input-field"
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label className="input-label">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input-field"
              placeholder="Enter new password"
            />
          </div>
          <div>
            <label className="input-label">Confirm New Password</label>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="input-field"
              placeholder="Confirm new password"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            onClick={handleChangePassword}
            disabled={isChangingPassword}
            className="btn-primary w-full"
          >
            {isChangingPassword ? <LoadingSpinner size="sm" /> : 'Change Password'}
          </button>
        </div>
      </Modal>

      {/* Export Private Key Modal */}
      <Modal isOpen={activeModal === 'export-key'} onClose={resetModals} title="Export Private Key">
        <div className="space-y-4">
          <WarningBanner
            type="danger"
            title="Security Warning"
            message="Never share your private key with anyone. Anyone with your private key can steal your funds."
          />
          {!exportedData ? (
            <>
              <div>
                <label className="input-label">Enter Password to Verify</label>
                <input
                  type="password"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  className="input-field"
                  placeholder="Enter your password"
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                onClick={handleExportKey}
                disabled={isExporting || !exportPassword}
                className="btn-danger w-full"
              >
                {isExporting ? <LoadingSpinner size="sm" /> : 'Reveal Private Key'}
              </button>
            </>
          ) : (
            <>
              <div className="bg-grokie-mid-gray rounded-xl p-4">
                <p className="text-xs font-mono break-all text-gray-200">{exportedData}</p>
              </div>
              <button onClick={handleCopyExported} className="btn-secondary w-full">
                Copy to Clipboard
              </button>
            </>
          )}
        </div>
      </Modal>

      {/* Export Recovery Phrase Modal */}
      <Modal isOpen={activeModal === 'export-phrase'} onClose={resetModals} title="Export Recovery Phrase">
        <div className="space-y-4">
          <WarningBanner
            type="danger"
            title="Security Warning"
            message="Never share your recovery phrase with anyone. Anyone with these words can steal your funds permanently."
          />
          {!exportedData ? (
            <>
              <div>
                <label className="input-label">Enter Password to Verify</label>
                <input
                  type="password"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  className="input-field"
                  placeholder="Enter your password"
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                onClick={handleExportPhrase}
                disabled={isExporting || !exportPassword}
                className="btn-danger w-full"
              >
                {isExporting ? <LoadingSpinner size="sm" /> : 'Reveal Recovery Phrase'}
              </button>
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {exportedData.split(' ').map((word, i) => (
                  <div key={i} className="bg-grokie-mid-gray rounded-lg px-2 py-1 text-center">
                    <span className="text-xs text-gray-500">{i + 1}.</span>{' '}
                    <span className="text-xs font-medium">{word}</span>
                  </div>
                ))}
              </div>
              <button onClick={handleCopyExported} className="btn-secondary w-full">
                Copy to Clipboard
              </button>
            </>
          )}
        </div>
      </Modal>

      {/* Delete Wallet Modal */}
      <Modal isOpen={activeModal === 'delete-wallet'} onClose={resetModals} title="Delete Wallet">
        <div className="space-y-4">
          <WarningBanner
            type="danger"
            title="Irreversible Action"
            message="This will permanently delete your wallet from this device. Make sure you have backed up your recovery phrase. This action cannot be undone."
          />
          <div>
            <label className="input-label">Enter Password</label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="input-field"
              placeholder="Enter your password"
            />
          </div>
          <div>
            <label className="input-label">Type DELETE to confirm</label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="input-field"
              placeholder="Type DELETE"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            onClick={handleDeleteWallet}
            disabled={isDeleting || deleteConfirmText !== 'DELETE' || !deletePassword}
            className="btn-danger w-full"
          >
            {isDeleting ? <LoadingSpinner size="sm" /> : 'Permanently Delete Wallet'}
          </button>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
