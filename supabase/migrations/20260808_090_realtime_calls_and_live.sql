-- SUPERSEDED by 20260809_000_consolidated_security_reset.sql — DO NOT RUN.
--
-- absorbed as Phase 6.
-- Running this after the reset would layer a superseded rule set back on top.
-- Kept for the reasoning in its comments only.
--
-- Everything below is disabled.
/*
-- Realtime for calls and live, with the row-level security it requires first.
--
-- Verified 2026-08-08 with scripts/verify-realtime-enabled.mjs: none of
-- call_signals, call_sessions, live_comments or live_gifts is in the
-- supabase_realtime publication, so every one of these features falls back to
-- polling. They work, but a live comment takes up to 2.5s to appear and a call
-- negotiates over repeated HTTP requests instead of a push.
--
-- ORDER MATTERS. Realtime honours RLS for postgres_changes, but a table with
-- RLS disabled — or with a permissive "true" policy — streams every row to any
-- client holding the anon key. Publishing call_signals in that state would
-- broadcast the SDP and ICE candidates of every call in the system to anybody
-- who subscribed. So this migration enables RLS and writes the policies BEFORE
-- adding anything to the publication.
--
-- Run 20260808_060_critical_rls_lockdown.sql before this one. That migration
-- closes the anon reads on messages, users and notifications; this one only
-- covers the four realtime tables.

begin;

-- ---------------------------------------------------------------------------
-- call_signals: the WebRTC handshake. Only the two peers may read it.
-- ---------------------------------------------------------------------------
alter table public.call_signals enable row level security;

drop policy if exists call_signals_participants_select on public.call_signals;
create policy call_signals_participants_select
    on public.call_signals for select
    to authenticated
    using (
        exists (
            select 1
            from public.users u
            where u.id = auth.uid()
              and u.id in (call_signals.sender_id, call_signals.receiver_id)
        )
    );

-- Writes go through the service role in /api/calls, which bypasses RLS. No
-- insert policy is granted to authenticated: a client that could write signals
-- directly could inject an offer into someone else's call.

-- ---------------------------------------------------------------------------
-- call_sessions: a member sees only calls they are part of.
-- ---------------------------------------------------------------------------
alter table public.call_sessions enable row level security;

drop policy if exists call_sessions_participants_select on public.call_sessions;
create policy call_sessions_participants_select
    on public.call_sessions for select
    to authenticated
    using (auth.uid() in (caller_id, receiver_id));

-- ---------------------------------------------------------------------------
-- live_comments and live_gifts: a live room is public by design. Anyone signed
-- in may read them; writes still go through the API so gating and quotas apply.
-- ---------------------------------------------------------------------------
alter table public.live_comments enable row level security;

drop policy if exists live_comments_public_select on public.live_comments;
create policy live_comments_public_select
    on public.live_comments for select
    to authenticated
    using (true);

alter table public.live_gifts enable row level security;

drop policy if exists live_gifts_public_select on public.live_gifts;
create policy live_gifts_public_select
    on public.live_gifts for select
    to authenticated
    using (true);

-- ---------------------------------------------------------------------------
-- Only now, publish. `add table` errors if the table is already a member, so
-- each is guarded.
-- ---------------------------------------------------------------------------
do $$
declare
    t text;
begin
    foreach t in array array['call_signals', 'call_sessions', 'live_comments', 'live_gifts']
    loop
        if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = t
        ) then
            execute format('alter publication supabase_realtime add table public.%I', t);
        end if;
    end loop;
end $$;

-- Realtime sends only the primary key on UPDATE/DELETE unless replica identity
-- is full. The call pages read status off the changed row, so they need it.
alter table public.call_sessions replica identity full;

commit;

-- Verify with:
--   select tablename from pg_publication_tables
--   where pubname = 'supabase_realtime' and schemaname = 'public'
--   order by tablename;
--
-- Then re-run scripts/verify-realtime-enabled.mjs. It subscribes with the anon
-- key, so it will report 'off' until a signed-in session exists — which is the
-- correct result for call_signals: an anonymous client must not receive them.

*/
