import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GROKIE Wallet - Secure Solana Wallet',
  description: 'A production-ready, non-custodial Web3 wallet for the Solana blockchain.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-grokie-black text-grokie-white min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
