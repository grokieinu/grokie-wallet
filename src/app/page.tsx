'use client';

import '@/lib/polyfills';
import { useState, useCallback } from 'react';
import { WalletProvider, useWalletContext } from '@/context/WalletContext';
import { WelcomePage } from '@/components/pages/WelcomePage';
import { CreateWalletPage } from '@/components/pages/CreateWalletPage';
import { ImportWalletPage } from '@/components/pages/ImportWalletPage';
import { BackupPhrasePage } from '@/components/pages/BackupPhrasePage';
import { DashboardPage } from '@/components/pages/DashboardPage';
import { SendPage } from '@/components/pages/SendPage';
import { ReceivePage } from '@/components/pages/ReceivePage';
import { AssetsPage } from '@/components/pages/AssetsPage';
import { AddTokenPage } from '@/components/pages/AddTokenPage';
import { TransactionsPage } from '@/components/pages/TransactionsPage';
import { SettingsPage } from '@/components/pages/SettingsPage';
import { TwoFactorPage } from '@/components/pages/TwoFactorPage';
import { UnlockPage } from '@/components/pages/UnlockPage';
import { TokenDetailPage } from '@/components/pages/TokenDetailPage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SplashScreen } from '@/components/ui/SplashScreen';

function AppContent() {
  const { currentPage, isLoading } = useWalletContext();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading GROKIE Wallet..." />
      </div>
    );
  }

  switch (currentPage) {
    case 'welcome':
      return <WelcomePage />;
    case 'create-wallet':
      return <CreateWalletPage />;
    case 'import-wallet':
      return <ImportWalletPage />;
    case 'backup-phrase':
      return <BackupPhrasePage />;
    case 'dashboard':
      return <DashboardPage />;
    case 'send':
      return <SendPage />;
    case 'receive':
      return <ReceivePage />;
    case 'assets':
      return <AssetsPage />;
    case 'add-token':
      return <AddTokenPage />;
    case 'transactions':
      return <TransactionsPage />;
    case 'settings':
      return <SettingsPage />;
    case 'two-factor':
      return <TwoFactorPage />;
    case 'unlock':
      return <UnlockPage />;
    case 'token-detail':
      return <TokenDetailPage />;
    default:
      return <WelcomePage />;
  }
}

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);

  return (
    <WalletProvider>
      {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
      <main className="max-w-lg mx-auto min-h-screen">
        <AppContent />
      </main>
    </WalletProvider>
  );
}
