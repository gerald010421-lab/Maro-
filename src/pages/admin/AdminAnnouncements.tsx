import { useCallback, useEffect, useState } from 'react';
import { Megaphone, Pin, PinOff, Trash2, Send } from 'lucide-react';
import { getClient, friendlyError } from '../../lib/supabase';
import { useToast, useAuth } from '../../lib/context';
import type { Announcement } from '../../lib/types';
import { timeAgo } from '../../lib/format';
import { Card, DCLButton, Field, EmptyState, Skeleton } from '../../components/ui';

const TAGS = ['general', 'lottery', 'wallet', 'maintenance', 'jackpot'] as const;

export default function AdminAnnouncements() {
  const { push } = useToast();
  const { profile } = useAuth();
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tag, setTag] = useState<typeof TAGS[number]>('general');
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await getClient().from('announcements').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
    if (error) push('error', 'Load failed', friendlyError(error));
    setItems((data as Announcement[]) ?? []);
  }, [push]);
  useEffect(() => { load(); }, [load]);

  const publish = async () => {
    if (title.trim().length < 4 || body.trim().length < 12) { push('error', 'Too brief', 'Title ≥ 4 chars, body ≥ 12 chars.'); return; }
    setBusy(true);
    try {
      const { error } = await getClient().from('announcements').insert({
        title: title.trim(), body: body.trim(), tag, is_pinned: pinned,
        author_id: profile?.id ?? null, author_email: profile?.email ?? null,
      });
      if (error) throw error;
      setTitle(''); setBody(''); setPinned(false); setTag('general');
      push('gold', 'Announcement published', 'Broadcast to every member in real time.');
      await load();
    } catch (e) {
      push('error', 'Publish failed', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const togglePin = async (a: Announcement) => {
    const { error } = await getClient().from('announcements').update({ is_pinned: !a.is_pinned }).eq('id', a.id);
    if (error) { push('error', 'Update failed', friendlyError(error)); return; }
    await load();
  };
  const remove = async (a: Announcement) => {
    if (!window.confirm(`Delete "${a.title}"? This is permanent.`)) return;
    const { error } = await getClient().from('announcements').delete().eq('id', a.id);
    if (error) { push('error', 'Delete failed', friendlyError(error)); return; }
    push('info', 'Announcement removed');
    await load();
  };

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      {/* composer */}
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-50 flex items-center gap-2"><Megaphone size={20} className="text-amber-400" />Broadcast <span className="gold-text">Announcement</span></h1>
          <p className="text-[10.5px] text-zinc-500 mt-1">Published instantly to the member app and linked from notifications. Signed by the admin desk.</p>
        </div>
        <Card sheen className="p-5 space-y-4">
          <Field label="Title"><input className="field" placeholder="Grand Jackpot extended through the weekend" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Message"><textarea className="field min-h-[130px]" placeholder="Write as the treasury — clear, precise, warm." value={body} onChange={(e) => setBody(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3 items-end">
            <Field label="Tag"><select className="field" value={tag} onChange={(e) => setTag(e.target.value as typeof TAGS[number])}>{TAGS.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
            <label className="flex items-center gap-2.5 rounded-xl border border-white/10 px-4 py-3.5 cursor-pointer select-none">
              <input type="checkbox" className="w-4 h-4 accent-[#e2a62e]" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              <span className="text-[11px] font-bold text-zinc-300">Pin to top</span>
            </label>
          </div>
          <DCLButton gold size="lg" className="w-full" loading={busy} onClick={publish}><Send size={15} />Publish to all members</DCLButton>
        </Card>
      </div>

      {/* published list */}
      <div className="space-y-3">
        <h2 className="text-[10px] uppercase tracking-[0.22em] text-zinc-600 font-extrabold pt-1">Published ({items?.length ?? '…'})</h2>
        {items === null && [1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
        {items !== null && items.length === 0 && <Card><EmptyState icon={<Megaphone size={24} />} title="Nothing published" body="Your first broadcast will appear here and in every member's app." /></Card>}
        {(items ?? []).map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="chip chip-open">{a.tag}</span>
              {a.is_pinned && <span className="chip chip-admin"><Pin size={8} />pinned</span>}
              <span className="text-[8.5px] text-zinc-600 font-mono ml-auto">{timeAgo(a.created_at)}</span>
            </div>
            <p className="text-[12.5px] font-bold text-zinc-100 mt-1.5">{a.title}</p>
            <p className="text-[10.5px] text-zinc-500 mt-0.5 line-clamp-2">{a.body}</p>
            <div className="flex gap-2 mt-2.5">
              <button onClick={() => togglePin(a)} className="text-[9.5px] font-bold text-zinc-500 hover:text-gold-200 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-white/8">{a.is_pinned ? <><PinOff size={10} />Unpin</> : <><Pin size={10} />Pin</>}</button>
              <button onClick={() => remove(a)} className="text-[9.5px] font-bold text-zinc-500 hover:text-rose-300 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-white/8"><Trash2 size={10} />Delete</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
