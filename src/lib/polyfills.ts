/**
 * GROKIE Wallet - Browser Polyfills
 * 
 * Provides necessary polyfills for crypto libraries that expect
 * Node.js globals (Buffer) to be available in the browser.
 */

import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).Buffer = Buffer;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Buffer = Buffer;
}

export {};
