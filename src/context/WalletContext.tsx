'use client';

/**
 * GROKIE Wallet - Wallet Context Provider
 * 
 * Provides wallet state and operations to all components.
 * Manages the application's navigation state and wallet lifecycle.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAllWallets, getSettings, type WalletRecord } from '@/lib/storage';
import { getSessionState, lockSession } from '@/lib/session';
import { getDefaultRpcEndpoint } from '@/lib/rpc';

export type AppPage =
  | 'welcome'
  | 'create-wallet'
  | 'import-wallet'
  | 'backup-phrase'
  | 'dashboard'
  | 'assets'
  | 'add-token'
  | 'send'
  | 'receive'
  | 'transactions'
  | 'settings'
  | 'two-factor'
  | 'unlock';

interface WalletContextType {
  currentPage: AppPage;
  setCurrentPage: (page: AppPage) => void;
  wallet: WalletRecord | null;
  setWallet: (wallet: WalletRecord | null) => void;
  isUnlocked: boolean;
  setIsUnlocked: (unlocked: boolean) => void;
  isLoading: boolean;
  rpcEndpoint: string;
  setRpcEndpoint: (endpoint: string) => void;
  refreshWallet: () => Promise<void>;
  lockWallet: () => void;
  tempSeedPhrase: string | null;
  setTempSeedPhrase: (phrase: string | null) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [currentPage, setCurrentPage] = useState<AppPage>('welcome');
  const [wallet, setWallet] = useState<WalletRecord | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [rpcEndpoint, setRpcEndpoint] = useState(getDefaultRpcEndpoint());
  // SECURITY: Temporary seed phrase stored in state only during backup flow
  const [tempSeedPhrase, setTempSeedPhrase] = useState<string | null>(null);

  // Initialize - check if wallet exists
  useEffect(() => {
    const init = async () => {
      try {
        const wallets = await getAllWallets();
        const settings = await getSettings();
        const session = getSessionState();

        if (settings?.rpcEndpoint) {
          setRpcEndpoint(settings.rpcEndpoint);
        }

        if (wallets.length > 0) {
          setWallet(wallets[0]);
          if (session.isUnlocked && session.walletId === wallets[0].id) {
            setIsUnlocked(true);
            setCurrentPage('dashboard');
          } else {
            setCurrentPage('unlock');
          }
        } else {
          setCurrentPage('welcome');
        }
      } catch {
        setCurrentPage('welcome');
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  // Listen for auto-lock events
  useEffect(() => {
    const handleLocked = () => {
      setIsUnlocked(false);
      setCurrentPage('unlock');
      // SECURITY: Clear temporary sensitive data
      setTempSeedPhrase(null);
    };

    window.addEventListener('grokie-wallet-locked', handleLocked);
    return () => window.removeEventListener('grokie-wallet-locked', handleLocked);
  }, []);

  const refreshWallet = useCallback(async () => {
    const wallets = await getAllWallets();
    if (wallets.length > 0) {
      setWallet(wallets[0]);
    } else {
      setWallet(null);
      setIsUnlocked(false);
      setCurrentPage('welcome');
    }
  }, []);

  const lockWallet = useCallback(() => {
    lockSession();
    setIsUnlocked(false);
    setTempSeedPhrase(null);
    setCurrentPage('unlock');
  }, []);

  return (
    <WalletContext.Provider
      value={{
        currentPage,
        setCurrentPage,
        wallet,
        setWallet,
        isUnlocked,
        setIsUnlocked,
        isLoading,
        rpcEndpoint,
        setRpcEndpoint,
        refreshWallet,
        lockWallet,
        tempSeedPhrase,
        setTempSeedPhrase,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext(): WalletContextType {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletContext must be used within a WalletProvider');
  }
  return context;
}
