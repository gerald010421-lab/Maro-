/** Network-aware address validation. Never invents addresses — only verifies shape. */

export interface NetworkRule {
  symbol: string;
  network: string;
  pattern: RegExp;
  hint: string;
  memoRequired?: boolean;
  memoHint?: string;
}

export const NETWORK_RULES: NetworkRule[] = [
  { symbol: 'BTC', network: 'Bitcoin', pattern: /^(bc1[ac-hj-np-z02-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/, hint: 'bc1… (bech32) or 1…/3… (legacy/segwit)' },
  { symbol: 'ETH', network: 'ERC-20', pattern: /^0x[a-fA-F0-9]{40}$/, hint: '0x followed by 40 hex chars' },
  { symbol: 'USDT', network: 'TRC-20', pattern: /^T[1-9A-HJ-NP-Za-km-z]{33}$/, hint: 'T followed by 33 base58 chars' },
  { symbol: 'USDT', network: 'ERC-20', pattern: /^0x[a-fA-F0-9]{40}$/, hint: '0x followed by 40 hex chars' },
  { symbol: 'USDC', network: 'ERC-20', pattern: /^0x[a-fA-F0-9]{40}$/, hint: '0x followed by 40 hex chars' },
  { symbol: 'BNB', network: 'BEP-20', pattern: /^0x[a-fA-F0-9]{40}$/, hint: '0x followed by 40 hex chars (BSC)' },
  { symbol: 'SOL', network: 'Solana', pattern: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/, hint: '32–44 base58 chars' },
  { symbol: 'XRP', network: 'Ripple', pattern: /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/, hint: 'r followed by 24–34 base58 chars', memoRequired: true, memoHint: 'Destination tag required by most exchanges' },
  { symbol: 'DOGE', network: 'Dogecoin', pattern: /^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{31,33}$/, hint: 'D followed by 32–34 base58 chars' },
];

export function validateAddress(symbol: string, network: string, address: string): { ok: boolean; message: string } {
  const trimmed = address.trim();
  if (!trimmed) return { ok: false, message: 'Address is required.' };
  const rule = NETWORK_RULES.find((r) => r.symbol === symbol && r.network === network)
    ?? NETWORK_RULES.find((r) => r.symbol === symbol);
  if (!rule) return { ok: true, message: 'No format rule for this asset — verify carefully.' };
  if (!rule.pattern.test(trimmed)) {
    return { ok: false, message: `Not a valid ${rule.network} address. Expected: ${rule.hint}` };
  }
  return { ok: true, message: `Valid ${rule.network} address format.` };
}

export function requiresMemo(symbol: string, network: string): { required: boolean; hint?: string } {
  const rule = NETWORK_RULES.find((r) => r.symbol === symbol && r.network === network);
  return { required: !!rule?.memoRequired, hint: rule?.memoHint };
}

export function validateTxHash(hash: string): boolean {
  const t = hash.trim();
  return /^(0x)?[a-fA-F0-9]{32,128}$/.test(t) || /^[a-zA-Z0-9]{30,120}$/.test(t);
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) || /[^a-zA-Z0-9]/.test(pw)) score++;
  const labels = ['Too short', 'Weak', 'Fair', 'Strong', 'Fortress'] as const;
  return { score: Math.min(score, 4) as 0 | 1 | 2 | 3 | 4, label: labels[Math.min(score, 4)] };
}
