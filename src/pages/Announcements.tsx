import { useEffect, useState } from 'react';
import { Megaphone, Pin, Tag } from 'lucide-react';
import { getClient } from '../lib/supabase';
import type { Announcement } from '../lib/types';
import { timeAgo, fullDate } from '../lib/format';
import { Card, EmptyState, Skeleton } from '../components/ui';

const TAG_STYLE: Record<Announcement['tag'], string> = {
  general: 'chip-gray', lottery: 'chip-open', wallet: 'chip-live', maintenance: 'chip-drawn', jackpot: 'chip-paid',
};

export default function Announcements() {
  const [items, setItems] = useState<Announcement[] | null>(null);

  useEffect(() => {
    const c = getClient();
    const load = () => c.from('announcements').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setItems((data as Announcement[]) ?? []));
    load();
    const ch = c.channel('announcements-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, load)
      .subscribe();
    return () => { c.removeChannel(ch); };
  }, []);

  const pinned = (items ?? []).filter((a) => a.is_pinned);
  const rest = (items ?? []).filter((a) => !a.is_pinned);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <div className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.25em] text-gold-500 font-extrabold"><Megaphone size={12} />Treasury Dispatch</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-50 mt-1">Announcements</h1>
        <p className="text-[11px] text-zinc-500 mt-1">Official notices from the Digital Coin Lottery treasury — pinned items first. Real-time, straight from the admin desk.</p>
      </div>

      {items === null && <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>}
      {items !== null && items.length === 0 && <Card><EmptyState icon={<Megaphone size={26} />} title="Silence from the treasury" body="No announcements yet. When the treasury publishes, it will appear here instantly." /></Card>}

      {pinned.length > 0 && (
        <div className="space-y-3">
          <div className="text-[9px] uppercase tracking-[0.22em] text-gold-500 font-extrabold flex items-center gap-1.5 px-1"><Pin size={10} />Pinned by treasury</div>
          {pinned.map((a) => <AnnouncementCard key={a.id} a={a} pinned />)}
        </div>
      )}
      {rest.length > 0 && (
        <div className="space-y-3">
          {pinned.length > 0 && <div className="text-[9px] uppercase tracking-[0.22em] text-zinc-600 font-extrabold px-1 pt-1">Earlier dispatches</div>}
          {rest.map((a) => <AnnouncementCard key={a.id} a={a} />)}
        </div>
      )}
    </div>
  );
}

function AnnouncementCard({ a, pinned }: { a: Announcement; pinned?: boolean }) {
  return (
    <Card sheen className={`p-5 sm:p-6 ${pinned ? 'border-gold-500/40' : ''}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`chip ${TAG_STYLE[a.tag] ?? 'chip-gray'}`}><Tag size={9} />{a.tag}</span>
        {pinned && <span className="chip chip-admin"><Pin size={9} />Pinned</span>}
        <span className="text-[9px] text-zinc-600 font-mono ml-auto" title={fullDate(a.created_at)}>{timeAgo(a.created_at)}</span>
      </div>
      <h2 className="font-display text-[17px] text-zinc-50 mt-2.5 leading-snug">{a.title}</h2>
      <p className="text-[12px] text-zinc-400 mt-1.5 leading-relaxed whitespace-pre-line">{a.body}</p>
      {a.author_email && <p className="text-[8.5px] text-zinc-700 font-mono mt-3 pt-3 border-t border-white/5">signed, {a.author_email}</p>}
    </Card>
  );
}
