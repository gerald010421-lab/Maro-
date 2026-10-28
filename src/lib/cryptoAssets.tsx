import type { JSX } from 'react';

/** Hand-drawn inline coin glyphs — no emoji, consistent black/gold rendering. */

export function AssetIcon({ symbol, size = 36, className }: { symbol: string; size?: number; className?: string }) {
  const s = size;
  const common: Record<string, JSX.Element> = {
    BTC: (
      <g>
        <circle cx="24" cy="24" r="22" fill="#f7931a" />
        <circle cx="24" cy="24" r="22" fill="url(#coinShade)" />
        <path d="M33.4 21.1c.5-3.1-1.9-4.7-5-5.8l1-4.1-2.5-.6-1 4-2-.5 1-4-2.5-.6-1 4-5.5-1.4-.6 2.5 2 .5c.9.2 1 .7 1.1 1.1l-2.4 9.6c-.2.6-.5 1.3-1.5 1l-2-.5-1.3 2.5 5.2 1.3 3.6.9 4.5 1.1-.6-2.5 1.8.4 1-4 2 .5-.9-3.9zm-3.6 9.6c-.7 2.8-5.7 1.3-7.3 1l1.4-5.4c2.9.7 7.4 2.1 6.9 4.4z" fill="#fff" transform="translate(0 1)" />
      </g>
    ),
    ETH: (
      <g>
        <circle cx="24" cy="24" r="22" fill="#627eea" />
        <circle cx="24" cy="24" r="22" fill="url(#coinShade)" />
        <path d="M24 9l-7.3 12.3L24 27.4l7.3-6.1L24 9z" fill="#fff" fillOpacity=".95" />
        <path d="M24 29.5l-7.3-4.3 7.3 13.3 7.3-13.3L24 29.5z" fill="#fff" fillOpacity=".75" />
        <path d="M24 27.4l7.3-6.1L24 9v18.4z" fill="#fff" fillOpacity=".55" />
      </g>
    ),
    USDT: (
      <g>
        <circle cx="24" cy="24" r="22" fill="#26a17b" />
        <circle cx="24" cy="24" r="22" fill="url(#coinShade)" />
        <path d="M25.6 23.6v-.01c-.1.01-.5.04-1.6.04-.8 0-1.4-.03-1.9-.05v-.01c-4.1-.18-7.2-.9-7.2-1.75 0-.84 3.1-1.56 7.2-1.74v2.78c.5.05 1.1.1 1.9.1.9 0 1.5-.07 1.6-.1v-2.79c4.1.18 7.1.9 7.1 1.75s-3 1.56-7.1 1.74h0zm0-3.4h.01V13.2H30v-4.6H17.4V13h4.6v7h0c-4.7.22-8.2 1.15-8.2 2.28 0 1.13 3.5 2.06 8.2 2.28v8.4h5.2v-8.4c4.7-.22 8.2-1.16 8.2-2.28 0-1.13-3.6-2.07-8.2-2.28z" fill="#fff" transform="translate(0 -1.5)" />
      </g>
    ),
    USDC: (
      <g>
        <circle cx="24" cy="24" r="22" fill="#2775ca" />
        <circle cx="24" cy="24" r="22" fill="url(#coinShade)" />
        <circle cx="24" cy="24" r="11.5" fill="none" stroke="#fff" strokeWidth="2.4" />
        <path d="M27.6 19.2c-.9-.8-2-1.2-3.6-1.2-2.5 0-3.9 1.2-3.9 2.9 0 4 7.5 2.1 7.5 6.6 0 1.7-1.6 2.9-4.2 2.9-1.8 0-3-.6-4-1.5M24 15v3.2m0 15.6V47" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" transform="translate(0 -2) scale(0.92) translate(2 1)" />
      </g>
    ),
    BNB: (
      <g>
        <circle cx="24" cy="24" r="22" fill="#f0b90b" />
        <circle cx="24" cy="24" r="22" fill="url(#coinShade)" />
        <path d="M24 13l3.9 3.9L22 23 24 24.9 31.4 17.6 35 21.2 24 32.4 13 21.3 16.6 17.6 24 24.9l2.6-2.6L24 13z" fill="#fff" transform="translate(0 3) scale(0.96)" opacity="0" />
        <path d="M24 11.5l4.7 4.7L24 20.9l-4.7-4.7L24 11.5zM14.3 21.2L19 26l-4.7 4.7-4.7-4.7 4.7-4.8zM24 21.9L28.7 26.6 24 31.3l-4.7-4.7L24 21.9zM33.7 21.2l4.7 4.8-4.7 4.7-4.7-4.7 4.7-4.8zM24 32.5l4.7 4.7-4.7 4.7-4.7-4.7 4.7-4.7z" fill="#fff" />
      </g>
    ),
    SOL: (
      <g>
        <circle cx="24" cy="24" r="22" fill="#151220" />
        <circle cx="24" cy="24" r="22" fill="url(#coinShade)" />
        <path d="M17.6 29.5l2.6-2.6h15l-2.6 2.6h-15z" fill="url(#solGrad)" />
        <path d="M17.6 19.9l2.6-2.6h15l-2.6 2.6h-15z" fill="url(#solGrad)" opacity=".85" />
        <path d="M17.6 24.7l2.6-2.6h15l-2.6 2.6h-15z" fill="url(#solGrad2)" />
      </g>
    ),
    XRP: (
      <g>
        <circle cx="24" cy="24" r="22" fill="#23292f" />
        <circle cx="24" cy="24" r="22" fill="url(#coinShade)" />
        <path d="M15.5 16.5h5l3.5 3.6 3.5-3.6h5l-5.9 6.1 6 6.3h-5l-3.6-3.7-3.6 3.7h-5l6-6.2-5.9-6.2z" fill="#fff" opacity=".92" />
      </g>
    ),
    DOGE: (
      <g>
        <circle cx="24" cy="24" r="22" fill="#c2a633" />
        <circle cx="24" cy="24" r="22" fill="url(#coinShade)" />
        <path d="M28.6 15.5c-2.8-.8-6-.4-8 .9V15h-3v3h-2.6v3.3H22v9.4c0 2 1 3.3 3.3 3.3h2.3c5 0 8.3-3.4 8.3-9.3v-6c0-4-2-7.6-7.3-8.7z" fill="#fff" opacity=".95" />
      </g>
    ),
  };
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" className={className} role="img" aria-label={`${symbol} coin`}>
      <defs>
        <radialGradient id="coinShade" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".38" />
          <stop offset="38%" stopColor="#ffffff" stopOpacity=".05" />
          <stop offset="100%" stopColor="#000000" stopOpacity=".34" />
        </radialGradient>
        <linearGradient id="solGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00ffa3" /><stop offset="100%" stopColor="#dc1fff" />
        </linearGradient>
        <linearGradient id="solGrad2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#dc1fff" /><stop offset="100%" stopColor="#00c2ff" />
        </linearGradient>
      </defs>
      {common[symbol] ?? (
        <g>
          <circle cx="24" cy="24" r="22" fill="#e2a62e" />
          <text x="24" y="30" textAnchor="middle" fontSize="17" fontWeight="800" fill="#3a2703" fontFamily="Manrope, sans-serif">
            {symbol.slice(0, 1)}
          </text>
        </g>
      )}
    </svg>
  );
}

export const ASSET_COLORS: Record<string, string> = {
  BTC: '#f7931a', ETH: '#8a9cff', USDT: '#26a17b', USDC: '#8fcaf0',
  BNB: '#f0b90b', SOL: '#b388ff', XRP: '#9fb8d8', DOGE: '#e3c16f',
};
