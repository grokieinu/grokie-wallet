'use client';

import { useState } from 'react';

interface TokenIconProps {
  logoUrl?: string | null;
  symbol: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Token icon component with fallback to initials.
 * Handles image load errors gracefully.
 */
export function TokenIcon({ logoUrl, symbol, size = 'md' }: TokenIconProps) {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-xs',
    lg: 'text-sm',
  };

  // Show fallback if no URL or image failed to load
  if (!logoUrl || imgError) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-grokie-orange/30 to-grokie-orange/10 flex items-center justify-center border border-grokie-orange/20`}>
        <span className={`${textSizes[size]} font-bold text-grokie-orange`}>
          {symbol ? symbol.slice(0, 3).toUpperCase() : '?'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={symbol}
      className={`${sizeClasses[size]} rounded-full object-cover bg-grokie-mid-gray`}
      onError={() => setImgError(true)}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}
