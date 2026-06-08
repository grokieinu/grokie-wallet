# GROKIE Wallet 🟠

A production-ready, non-custodial Web3 wallet for the Solana blockchain. Built with Next.js 15, TypeScript, and Tailwind CSS.

**Your keys. Your crypto. Always.**

---

## Features

### Wallet Operations
- ✅ Create new Solana wallet with BIP39 seed phrase
- ✅ Import wallet via seed phrase (12/24 words)
- ✅ Import wallet via Base58 private key
- ✅ View SOL balance
- ✅ View SPL token balances
- ✅ Send SOL with transaction confirmation
- ✅ Receive via QR code and address copy
- ✅ Transaction history with explorer links
- ✅ Configurable RPC endpoint

### Security
- ✅ Fully non-custodial — keys never leave your browser
- ✅ AES-256-GCM encryption for private keys and seed phrases
- ✅ PBKDF2 key derivation (600,000 iterations)
- ✅ IndexedDB-only storage (no plaintext secrets)
- ✅ Auto-lock after inactivity
- ✅ Rate-limited password attempts (5 attempts, 5-min lockout)
- ✅ Anti-phishing warnings
- ✅ Address validation before sending
- ✅ Transaction review before signing
- ✅ Secure session management
- ✅ Memory clearing on logout
- ✅ Security headers (CSP, X-Frame-Options, etc.)

---

## Installation

### Prerequisites
- Node.js 18+ (recommended: 22.x)
- npm or yarn

### Setup

```bash
# Clone or navigate to the project
cd grokie-wallet

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

The app will be available at `http://localhost:3000`.

---

## Project Structure

```
grokie-wallet/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with metadata
│   │   ├── page.tsx            # Main app entry (client-side routing)
│   │   └── globals.css         # Tailwind + custom styles
│   ├── components/
│   │   ├── pages/
│   │   │   ├── WelcomePage.tsx
│   │   │   ├── CreateWalletPage.tsx
│   │   │   ├── ImportWalletPage.tsx
│   │   │   ├── BackupPhrasePage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── SendPage.tsx
│   │   │   ├── ReceivePage.tsx
│   │   │   ├── AssetsPage.tsx
│   │   │   ├── TransactionsPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   └── UnlockPage.tsx
│   │   └── ui/
│   │       ├── Logo.tsx
│   │       ├── LoadingSpinner.tsx
│   │       ├── WarningBanner.tsx
│   │       ├── Modal.tsx
│   │       └── Toast.tsx
│   ├── context/
│   │   └── WalletContext.tsx    # Global state management
│   └── lib/
│       ├── crypto.ts           # AES-256-GCM encryption/decryption
│       ├── session.ts          # Session & auto-lock management
│       ├── solana.ts           # Solana blockchain operations
│       ├── storage.ts          # IndexedDB secure storage
│       └── wallet-manager.ts   # High-level wallet orchestration
├── public/
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## Security Checklist

| Check | Status |
|-------|--------|
| Private keys encrypted with AES-256-GCM | ✅ |
| Seed phrases encrypted before storage | ✅ |
| PBKDF2 with 600,000 iterations for key derivation | ✅ |
| No plaintext secrets in storage | ✅ |
| IndexedDB only (no localStorage/cookies for secrets) | ✅ |
| Auto-lock after inactivity | ✅ |
| Rate-limited password attempts | ✅ |
| Memory cleared on session lock | ✅ |
| No console logging of sensitive data | ✅ |
| No analytics/tracking of sensitive operations | ✅ |
| Anti-phishing warnings on sensitive screens | ✅ |
| Address validation before transactions | ✅ |
| Transaction confirmation screen | ✅ |
| Password required for key/phrase export | ✅ |
| CSP headers configured | ✅ |
| X-Frame-Options: DENY | ✅ |
| No server-side key handling | ✅ |
| Unique IV per encryption operation | ✅ |
| Secure random generation (crypto.getRandomValues) | ✅ |

---

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

Or connect your GitHub repository to Vercel for automatic deployments.

### Cloudflare Pages

1. Push your code to GitHub/GitLab.
2. Go to Cloudflare Pages dashboard.
3. Create a new project and connect your repository.
4. Configure build settings:
   - **Framework preset:** Next.js
   - **Build command:** `npm run build`
   - **Build output directory:** `.next`
5. Deploy.

Note: For Cloudflare Pages with Next.js, you may need `@cloudflare/next-on-pages`:

```bash
npm install -D @cloudflare/next-on-pages
```

Update `package.json`:
```json
{
  "scripts": {
    "pages:build": "npx @cloudflare/next-on-pages",
    "pages:deploy": "wrangler pages deploy .vercel/output/static"
  }
}
```

### Static Export (Optional)

For purely static hosting without server features:

```js
// next.config.ts
const nextConfig = {
  output: 'export',
};
```

Then deploy the `out/` folder to any static host.

---

## Configuration

### RPC Endpoint

The default RPC endpoint is `https://api.mainnet-beta.solana.com`. You can change it in Settings within the app, or use a dedicated RPC provider for better reliability:

- [Helius](https://helius.dev)
- [QuickNode](https://quicknode.com)
- [Alchemy](https://alchemy.com)

### Auto-Lock

The wallet automatically locks after 5 minutes of inactivity by default. This is configurable in the session module.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **Blockchain:** @solana/web3.js, @solana/spl-token
- **Crypto:** Web Crypto API (AES-256-GCM, PBKDF2, SHA-256)
- **Key Derivation:** BIP39, BIP44 (ed25519-hd-key)
- **Storage:** IndexedDB (via idb)
- **QR Codes:** qrcode.react

---

## Security Notice

⚠️ **This wallet is fully non-custodial.** No private keys, seed phrases, or passwords ever leave your browser. There is no server-side component that handles sensitive data.

If you lose your password AND your recovery phrase, your funds are permanently inaccessible. Always back up your recovery phrase in a secure, offline location.

---

## License

MIT
