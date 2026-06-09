'use client';

interface WarningBannerProps {
  title: string;
  message: string;
  type?: 'warning' | 'danger' | 'info';
}

export function WarningBanner({ title, message, type = 'warning' }: WarningBannerProps) {
  const styles = {
    warning: 'bg-yellow-900/30 border-yellow-600/50 text-yellow-200',
    danger: 'bg-red-900/30 border-red-600/50 text-red-200',
    info: 'bg-blue-900/30 border-blue-600/50 text-blue-200',
  };

  const icons = {
    warning: '⚠️',
    danger: '🚨',
    info: 'ℹ️',
  };

  return (
    <div className={`border rounded-xl p-4 ${styles[type]}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0">{icons[type]}</span>
        <div>
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-sm mt-1 opacity-90">{message}</p>
        </div>
      </div>
    </div>
  );
}
