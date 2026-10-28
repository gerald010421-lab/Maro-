/** Financial display helpers — values arrive as numbers from numeric(38,18). */

export function fmtCrypto(n: number | null | undefined, maxDp = 8): string {
  if (n == null || Number.isNaN(n)) return '0';
  const abs = Math.abs(n);
  const dp = abs >= 1000 ? 2 : abs >= 1 ? 4 : maxDp;
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: Math.min(dp, maxDp) });
}

export function fmtUsd(n: number | null | undefined, dp = 2): string {
  if (n == null || Number.isNaN(n)) return '$0.00';
  return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function fmtCompact(n: number): string {
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function fmtNum(n: number | null | undefined): string {
  if (n == null) return '0';
  return n.toLocaleString('en-US');
}

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function timeLeft(iso: string | null): string {
  if (!iso) return 'No deadline';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Closed';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export function fullDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function truncateMiddle(s: string, head = 10, tail = 8): string {
  if (!s) return '';
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

/** Deterministic hue from a string (avatar background fallback). */
export function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function initials(name: string | null | undefined, email?: string): string {
  const base = (name && name.trim()) || (email ? email.split('@')[0] : 'M');
  const parts = base.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? 'M') + (parts[1]?.[0] ?? '')).toUpperCase();
}
