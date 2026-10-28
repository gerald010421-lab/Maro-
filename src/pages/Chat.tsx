import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessagesSquare, SendHorizonal, Pin, Trash2, ShieldCheck, ChevronUp } from 'lucide-react';
import { useAuth, useToast } from '../lib/context';
import { getClient, friendlyError } from '../lib/supabase';
import type { ChatMessage } from '../lib/types';
import { timeAgo } from '../lib/format';
import { Avatar, DCLButton } from '../components/ui';

const PAGE = 40;

export default function Chat() {
  const { userId, profile, isAdmin } = useAuth();
  const { push } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ChatMessage['profile']>>({});
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const enrich = async (uids: string[]) => {
    const missing = [...new Set(uids)].filter((id) => !profiles[id]);
    if (missing.length === 0) return;
    const { data } = await getClient().from('profiles').select('id, username, full_name, avatar_color, role, email').in('id', missing);
    if (!data) return;
    setProfiles((prev) => {
      const next = { ...prev };
      for (const p of data as Array<{ id: string } & NonNullable<ChatMessage['profile']>>) next[p.id] = p;
      return next;
    });
  };

  useEffect(() => {
    const c = getClient();
    let mounted = true;
    c.from('chat_messages').select('*').eq('channel', 'global').eq('is_deleted', false)
      .order('created_at', { ascending: false }).limit(PAGE)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) { push('error', 'Chat unavailable', friendlyError(error)); return; }
        const rows = ((data as ChatMessage[]) ?? []).reverse();
        setMessages(rows);
        setHasMore(rows.length === PAGE);
        enrich(rows.map((m) => m.user_id));
        window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 60);
      });

    const ch = c.channel('global-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'channel=eq.global' }, (payload) => {
        const m = payload.new as ChatMessage;
        if (m.is_deleted) return;
        setMessages((prev) => [...prev, m]);
        enrich([m.user_id]);
        window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: 'channel=eq.global' }, (payload) => {
        const m = payload.new as ChatMessage;
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, is_pinned: m.is_pinned, is_deleted: m.is_deleted } : x)).filter((x) => !x.is_deleted));
      })
      .subscribe();
    return () => { mounted = false; c.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadMore = async () => {
    if (loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[0].created_at;
    const { data } = await getClient().from('chat_messages').select('*').eq('channel', 'global').eq('is_deleted', false)
      .lt('created_at', oldest).order('created_at', { ascending: false }).limit(PAGE);
    const rows = (((data as ChatMessage[]) ?? [])).reverse();
    setMessages((prev) => [...rows, ...prev]);
    setHasMore(rows.length === PAGE);
    enrich(rows.map((m) => m.user_id));
    setLoadingMore(false);
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setBody('');
    try {
      const { error } = await getClient().rpc('send_chat_message', { p_body: text });
      if (error) { setBody(text); throw error; }
    } catch (err) {
      push('error', 'Message not sent', friendlyError(err));
    } finally {
      setSending(false);
    }
  };

  const moderate = async (id: string, patch: Partial<ChatMessage>) => {
    const { error } = await getClient().from('chat_messages').update(patch).eq('id', id);
    if (error) push('error', 'Moderation failed', friendlyError(error));
  };

  const pinned = messages.filter((m) => m.is_pinned);

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-8.5rem)] min-h-[480px]">
      {/* header */}
      <div className="flex items-center justify-between gap-3 pb-3">
        <div>
          <div className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.25em] text-gold-500 font-extrabold"><MessagesSquare size={12} />Community Lounge</div>
          <h1 className="font-display text-2xl font-bold text-zinc-50 mt-0.5">Live <span className="gold-text">Chat</span></h1>
        </div>
        <div className="flex items-center gap-2 text-[9.5px] font-mono text-zinc-500 border border-white/8 rounded-xl px-3 py-2">
          <span className="live-dot" /> realtime · global channel
        </div>
      </div>

      {/* pinned banner */}
      {pinned.length > 0 && (
        <div className="rounded-xl border border-gold-500/35 bg-gold-500/8 px-3.5 py-2 mb-2 flex items-center gap-2 overflow-x-auto">
          <Pin size={12} className="text-gold-400 shrink-0" />
          <span className="text-[10.5px] text-gold-100 truncate font-semibold">{pinned[pinned.length - 1].body}</span>
        </div>
      )}

      {/* message stream */}
      <div ref={boxRef} className="flex-1 overflow-y-auto glass rounded-2xl border border-gold-500/15 px-3 sm:px-4 py-3 space-y-3">
        {hasMore && (
          <div className="text-center">
            <button onClick={loadMore} disabled={loadingMore} className="text-[10.5px] font-bold text-zinc-500 hover:text-gold-200 inline-flex items-center gap-1.5 py-1.5">
              <ChevronUp size={12} />{loadingMore ? 'Loading…' : 'Load earlier messages'}
            </button>
          </div>
        )}
        {messages.length === 0 && <p className="text-center text-[12px] text-zinc-600 py-14">The lounge is quiet. Be the first voice in the hall.</p>}

        {messages.map((m) => {
          const mine = m.user_id === userId;
          const p = profiles[m.user_id];
          const name = p?.full_name || p?.username || (p?.email ? p.email.split('@')[0] : 'Member');
          const admin = p?.role === 'admin';
          return (
            <div key={m.id} className={`bubble-in flex items-end gap-2.5 ${mine ? 'flex-row-reverse' : ''} group`}>
              <Avatar name={name} color={p?.avatar_color} size={32} />
              <div className={`max-w-[78%] sm:max-w-[70%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`flex items-center gap-1.5 mb-1 px-1 ${mine ? 'flex-row-reverse' : ''}`}>
                  <span className="text-[10px] font-extrabold text-zinc-300">{mine ? 'You' : name}</span>
                  {admin && <span className="chip chip-admin !text-[7.5px] !px-1.5 !py-0.5"><ShieldCheck size={8} />Admin</span>}
                  {m.is_pinned && <Pin size={9} className="text-gold-400" />}
                  <span className="text-[8px] text-zinc-600 font-mono">{timeAgo(m.created_at)}</span>
                </div>
                <div className={`relative rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-snug ${mine ? 'bg-gradient-to-br from-gold-500/28 to-gold-700/22 border border-gold-500/40 text-gold-50 rounded-br-md' : 'bg-[#1a1512] border border-white/8 text-zinc-100 rounded-bl-md'}`}>
                  {m.body}
                  {isAdmin && (
                    <div className="absolute -right-2 -bottom-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button onClick={() => moderate(m.id, { is_pinned: !m.is_pinned })} title={m.is_pinned ? 'Unpin' : 'Pin'} className="w-6 h-6 rounded-full bg-[#241c10] border border-gold-500/40 text-gold-300 flex items-center justify-center"><Pin size={10} /></button>
                      <button onClick={() => moderate(m.id, { is_deleted: true })} title="Remove" className="w-6 h-6 rounded-full bg-[#241010] border border-rose-500/45 text-rose-300 flex items-center justify-center"><Trash2 size={10} /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* composer */}
      <form onSubmit={send} className="flex items-center gap-2 pt-3">
        <input value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} placeholder="Speak with the hall… (500 chars)" className="field !py-3.5 !rounded-2xl" aria-label="Message" />
        <span className="text-[9px] font-mono text-zinc-600 w-9 text-right">{500 - body.length}</span>
        <DCLButton gold type="submit" loading={sending} className="!px-4 !py-3.5 !rounded-2xl" aria-label="Send"><SendHorizonal size={18} /></DCLButton>
      </form>
    </div>
  );
}
