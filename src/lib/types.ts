export type Role = 'user' | 'admin';

export interface Profile {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  avatar_color: string;
  role: Role;
  created_at: string;
}

export interface Asset {
  symbol: string;
  name: string;
  network: string;
  decimals: number;
  min_withdraw: number;
  withdraw_fee: number;
  icon: string;
  color: string;
  is_stable: boolean;
  is_enabled: boolean;
  sort_order: number;
}

export interface Wallet {
  id: string;
  user_id: string;
  asset: string;
  available: number;
  locked: number;
  usd_rate: number;
  updated_at: string;
}

export type PoolStatus = 'open' | 'closed' | 'drawn' | 'paid';

export interface Pool {
  id: string;
  name: string;
  subtitle: string;
  asset: string;
  ticket_price: number;
  prize_asset: string;
  prize_amount: number;
  prize_usd: number;
  capacity: number;
  tickets_sold: number;
  closes_at: string | null;
  status: PoolStatus;
  prize_funded: boolean;
  draw_method: string;
  min_tickets: number;
  max_tickets_per_user: number;
  winner_ticket: string | null;
  winner_id: string | null;
  drawn_at: string | null;
  payout_status: 'pending' | 'processing' | 'paid';
  payout_tx: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  pool_id: string;
  user_id: string;
  asset: string;
  price_paid: number;
  status: 'active' | 'won' | 'lost' | 'void';
  is_winner: boolean;
  created_at: string;
  pool?: { name: string; prize_asset: string; prize_amount: number; prize_usd: number; status: PoolStatus } | null;
}

export interface Transaction {
  id: string;
  ref: string;
  user_id: string;
  type: string;
  asset: string;
  amount: number;
  counter_asset: string | null;
  counter_amount: number | null;
  fee: number;
  direction: 'credit' | 'debit';
  status: 'pending' | 'completed' | 'failed' | 'review';
  provider: string;
  provider_ref: string | null;
  note: string;
  created_at: string;
}

export interface Adjustment {
  id: string;
  ref: string;
  user_id: string;
  asset: string;
  amount: number;
  reason: string;
  actor_id: string;
  actor_email: string | null;
  created_at: string;
}

export interface WelcomeAllocation {
  id: string;
  user_id: string;
  usd_amount: number;
  rate: number;
  btc_amount: number;
  fee_usd: number;
  conversion_ref: string;
  status: 'locked' | 'unlocked';
  unlock_requirement_usd: number;
  unlocked_at: string | null;
  unlock_deposit_id: string | null;
  created_at: string;
}

export interface PlatformAddress {
  id: string;
  title: string;
  purpose: string;
  asset: string;
  network: string;
  address: string;
  memo: string | null;
  instructions: string;
  status: 'active' | 'inactive';
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deposit {
  id: string;
  user_id: string;
  asset: string;
  network: string;
  amount: number;
  usd_value: number | null;
  tx_hash: string | null;
  source_address: string | null;
  status: 'pending' | 'confirming' | 'confirmed' | 'credited' | 'rejected';
  confirmations: number;
  required_confirmations: number;
  platform_address_id: string | null;
  credited_at: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  tag: 'general' | 'lottery' | 'wallet' | 'maintenance' | 'jackpot';
  is_pinned: boolean;
  author_email: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  kind: 'info' | 'success' | 'warning' | 'prize' | 'deposit' | 'system';
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  channel: string;
  user_id: string;
  body: string;
  is_pinned: boolean;
  is_deleted: boolean;
  created_at: string;
  profile?: { username: string | null; full_name: string | null; avatar_color: string; role: Role; email: string } | null;
}

export interface SupportMessage {
  id: string;
  user_id: string;
  sender_id: string;
  sender_role: 'user' | 'admin';
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface PricePoint {
  symbol: string;
  usd: number;
  change_24h: number;
  updated_at: string;
}

export interface RecentEntry {
  id: string;
  created_at: string;
  ticket_number: string;
  pool_name: string;
  prize_usd: number;
  masked_member: string;
}
