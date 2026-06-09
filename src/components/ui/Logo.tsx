'use client';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <div className="flex items-center gap-3">
      <img
        src="/logo.png"
        alt="GROKIE Wallet"
        className={`${sizes[size]} rounded-xl object-contain`}
      />
      {showText && (
        <span className={`font-bold ${textSizes[size]} bg-gradient-to-r from-grokie-orange to-grokie-orange-light bg-clip-text text-transparent`}>
          GROKIE
        </span>
      )}
    </div>
  );
}
