import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow external images from token logo CDNs
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
    unoptimized: true,
  },
  // Security headers for production
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://plugin.jup.ag; style-src 'self' 'unsafe-inline' https://plugin.jup.ag; connect-src 'self' https://api.mainnet-beta.solana.com https://*.helius-rpc.com https://token.jup.ag https://tokens.jup.ag https://api.jup.ag https://quote-api.jup.ag https://ultra-api.jup.ag https://lite-api.jup.ag https://api.dexscreener.com https://api.geckoterminal.com https://api.solana.fm https://api.coingecko.com https://*.jup.ag; img-src 'self' data: blob: https://*; font-src 'self' https://*; frame-src https://plugin.jup.ag https://*.jup.ag;",
        },
      ],
    },
  ],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        stream: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
