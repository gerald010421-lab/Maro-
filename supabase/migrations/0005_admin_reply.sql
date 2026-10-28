-- ============================================================
-- DIGITAL COIN LOTTERY — 0005 SUPPORT REPLY RPC
-- Admin replies route through a server function like everything
-- else: rate-limited, role-checked, and thread-scoped.
-- ============================================================

create or replace function public.admin_reply_support(p_thread_owner uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_admin uuid := auth.uid(); v_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if char_length(trim(coalesce(p_body,''))) < 1 or char_length(p_body) > 1000 then raise exception 'INVALID_BODY'; end if;
  if not public.check_rate_limit('support-admin', 60, 60) then raise exception 'RATE_LIMITED'; end if;
  if not exists (select 1 from public.profiles where id = p_thread_owner) then raise exception 'THREAD_NOT_FOUND'; end if;
  insert into public.support_messages(user_id, sender_id, sender_role, body)
  values (p_thread_owner, v_admin, 'admin', trim(p_body)) returning id into v_id;
  insert into public.notifications(user_id, title, body, kind, link)
  values (p_thread_owner, 'Treasury replied', left(trim(p_body), 140), 'info', '/support');
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
