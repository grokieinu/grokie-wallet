'use client';

import { useState, useEffect } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const [phase, setPhase] = useState<'footprints' | 'logo' | 'text' | 'exit'>('footprints');

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('logo'), 2000),
      setTimeout(() => setPhase('text'), 3000),
      setTimeout(() => setPhase('exit'), 4200),
      setTimeout(() => onFinish(), 4900),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onFinish]);

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-grokie-black transition-opacity duration-700 ${phase === 'exit' ? 'opacity-0' : 'opacity-100'}`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-grokie-orange/5 blur-3xl animate-pulse-slow" />
      </div>

      {/* Paw footprint trail */}
      <div className="relative w-64 h-32 mb-8">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="absolute animate-footprint-appear" style={{ left: `${i * 48}px`, top: `${i % 2 === 0 ? 8 : 48}px`, animationDelay: `${i * 300}ms`, transform: `rotate(${i % 2 === 0 ? -10 : 10}deg)` }}>
            <svg width="30" height="34" viewBox="0 0 30 34" fill="none" className="text-grokie-orange drop-shadow-[0_0_6px_rgba(249,115,22,0.5)]">
              <ellipse cx="15" cy="24" rx="7" ry="6.5" fill="currentColor" opacity="0.9" />
              <ellipse cx="8" cy="13" rx="3.5" ry="4.5" fill="currentColor" opacity="0.8" />
              <ellipse cx="15" cy="9" rx="3.5" ry="4.5" fill="currentColor" opacity="0.8" />
              <ellipse cx="22" cy="13" rx="3.5" ry="4.5" fill="currentColor" opacity="0.8" />
            </svg>
          </div>
        ))}
      </div>

      {/* Logo GROKIE Wallet */}
      <div className={`relative z-10 transition-all duration-700 ${phase === 'footprints' ? 'opacity-0 scale-50' : phase === 'logo' ? 'opacity-100 scale-100' : phase === 'text' ? 'opacity-100 scale-90 -translate-y-2' : 'opacity-0 scale-75 -translate-y-6'}`}>
        <div className="w-20 h-20 rounded-2xl shadow-2xl shadow-grokie-orange/40 relative overflow-hidden">
          <img src="/logo.png" alt="GROKIE" className="w-full h-full rounded-2xl object-contain" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer-slide" />
        </div>
      </div>

      {/* Text */}
      <div className={`relative z-10 mt-5 text-center transition-all duration-700 ${phase === 'text' ? 'opacity-100 translate-y-0' : phase === 'exit' ? 'opacity-0' : 'opacity-0 translate-y-4'}`}>
        <h1 className="text-3xl font-bold"><span className="bg-gradient-to-r from-grokie-orange to-grokie-orange-light bg-clip-text text-transparent">GROKIE</span></h1>
        <p className="text-sm text-gray-500 mt-1 tracking-[0.3em] uppercase">Wallet</p>
      </div>

      {/* Dots */}
      <div className={`absolute bottom-12 flex gap-2 transition-opacity duration-500 ${phase !== 'exit' ? 'opacity-100' : 'opacity-0'}`}>
        <div className="w-2 h-2 rounded-full bg-grokie-orange animate-loading-dot" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-grokie-orange animate-loading-dot" style={{ animationDelay: '200ms' }} />
        <div className="w-2 h-2 rounded-full bg-grokie-orange animate-loading-dot" style={{ animationDelay: '400ms' }} />
      </div>
    </div>
  );
}
