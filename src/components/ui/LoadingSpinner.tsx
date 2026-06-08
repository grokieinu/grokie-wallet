'use client';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export function LoadingSpinner({ size = 'md', text }: LoadingSpinnerProps) {
  const sizes = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`${sizes[size]} border-2 border-grokie-light-gray border-t-grokie-orange rounded-full animate-spin`} />
      {text && <p className="text-sm text-gray-400">{text}</p>}
    </div>
  );
}
