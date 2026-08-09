'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, Eye, Gift, Heart, MessageCircle, Send, Users, Wallet } from '@/components/icons';
import { createBrowserSupabaseClient, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import UserAvatar from '@/components/UserAvatar';
import GiftVisual from '@/components/GiftVisual';
import { triggerGiftEffect } from '@/components/GiftEffects';

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
];

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

function elapsedSeconds(startedAt) {
    const started = startedAt ? new Date(startedAt).getTime() : 0;
    if (!started || Number.isNaN(started)) return 0;
    return Math.max(0, Math.floor((Date.now() - started) / 1000));
}

export default function WatchLivePage({ params }) {
    const { id } = use(params);
    const { user } = useAuth();
    const [stream, setStream] = useState(null);
    const [comments, setComments] = useState([]);
    const [gifts, setGifts] = useState([]);
    const [giftCatalog, setGiftCatalog] = useState([]);
    const [text, setText] = useState('');
    const [giftPanelOpen, setGiftPanelOpen] = useState(false);
    const [status, setStatus] = useState('');
    const [seconds, setSeconds] = useState(0);
    const [hearts, setHearts] = useState([]);
    const remoteVideoRef = useRef(null);
    const pcRef = useRef(null);
    const channelRef = useRef(null);
    const seenGiftIdsRef = useRef(new Set());
    const chatRef = useRef(null);

    async function loadLive() {
        const res = await fetch(`/api/live?streamId=${encodeURIComponent(id)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            setStatus(data.error || 'Live stream unavailable.');
            return;
        }
        setStream(data.stream);
        setSeconds(elapsedSeconds(data.stream?.started_at));
        setComments(data.comments || []);
        setGifts(data.gifts || []);
        // A host who closed the tab sends no 'stream-ended' broadcast; the server
        // sweeps the stream instead. This poll is the only way a viewer learns of
        // it, so without this the room sat on a frozen frame indefinitely.
        if (data.stream?.is_active === false) {
            setStatus('This live stream has ended.');
            try { pcRef.current?.close(); } catch {}
            pcRef.current = null;
        }
    }

    async function loadWallet() {
        if (!user?.id) return;
        const res = await fetch(`/api/wallet?userId=${encodeURIComponent(user.id)}`);
        const data = await res.json().catch(() => ({}));
        if (res.ok) setGiftCatalog(data.giftCatalog || []);
    }

    useEffect(() => {
        loadLive();
        loadWallet();
    }, [id, user?.id]);

    useEffect(() => {
        if (!user?.id) return;
        fetch('/api/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'join_stream', streamId: id }) }).catch(() => {});
        return () => {
            fetch('/api/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'leave_stream', streamId: id }) }).catch(() => {});
        };
    }, [id, user?.id]);

    useEffect(() => {
        if (!stream?.started_at) return undefined;
        const timer = window.setInterval(() => setSeconds(elapsedSeconds(stream.started_at)), 1000);
        return () => window.clearInterval(timer);
    }, [stream?.started_at]);

    useEffect(() => {
        if (!user?.id || !stream?.id || !stream?.host_id || stream.host_id === user.id || !isSupabaseConfigured()) return undefined;
        const supabase = createBrowserSupabaseClient();
        const channel = supabase.channel(`gs-live-webrtc-${stream.id}`, { config: { broadcast: { self: false } } });
        channelRef.current = channel;
        const remoteStream = new MediaStream();
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;

        async function sendSignal(event, payload) {
            await channel.send({ type: 'broadcast', event, payload }).catch(() => {});
        }

        function ensurePeerConnection() {
            if (pcRef.current) return pcRef.current;
            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            pcRef.current = pc;
            pc.addTransceiver('video', { direction: 'recvonly' });
            pc.addTransceiver('audio', { direction: 'recvonly' });
            pc.ontrack = (event) => {
                event.streams?.[0]?.getTracks?.().forEach((track) => {
                    if (!remoteStream.getTracks().some((existing) => existing.id === track.id)) remoteStream.addTrack(track);
                });
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = event.streams?.[0] || remoteStream;
                    remoteVideoRef.current.muted = false;
                    remoteVideoRef.current.volume = 1;
                    remoteVideoRef.current.play?.().catch(() => setStatus('Tap the live screen once if audio does not start automatically.'));
                }
            };
            pc.onicecandidate = (event) => {
                if (event.candidate) sendSignal('viewer-ice', { to: stream.host_id, from: user.id, candidate: event.candidate.toJSON() });
            };
            pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'connected') setStatus('');
                if (pc.connectionState === 'failed') setStatus('Live connection failed. Reopen this live room.');
            };
            return pc;
        }

        channel
            .on('broadcast', { event: 'host-offer' }, async ({ payload }) => {
                if (payload?.to !== user.id || payload?.from !== stream.host_id) return;
                const pc = ensurePeerConnection();
                await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await sendSignal('viewer-answer', { to: stream.host_id, from: user.id, answer });
            })
            .on('broadcast', { event: 'host-ice' }, async ({ payload }) => {
                if (payload?.to !== user.id || payload?.from !== stream.host_id) return;
                const pc = ensurePeerConnection();
                if (payload.candidate) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
            })
            .on('broadcast', { event: 'stream-ended' }, ({ payload }) => {
                if (payload?.streamId === stream.id) setStatus('This live stream has ended.');
            })
            .subscribe((state) => {
                if (state === 'SUBSCRIBED') {
                    setStatus('Connecting to live video...');
                    sendSignal('viewer-ready', { streamId: stream.id, viewerId: user.id, hostId: stream.host_id });
                }
            });

        // Re-announce until the host answers. The host ignores a viewer it has
        // already built a connection for, so this is safe to repeat — but it ran
        // forever, re-announcing every 10 seconds for the whole stream even once
        // video was flowing. Stop as soon as the peer connection is up.
        const retry = window.setInterval(() => {
            if (pcRef.current?.connectionState === 'connected') {
                window.clearInterval(retry);
                return;
            }
            sendSignal('viewer-ready', { streamId: stream.id, viewerId: user.id, hostId: stream.host_id });
        }, 10000);

        return () => {
            window.clearInterval(retry);
            sendSignal('viewer-left', { streamId: stream.id, viewerId: user.id, hostId: stream.host_id });
            try { pcRef.current?.close(); } catch {}
            pcRef.current = null;
            try { supabase.removeChannel(channel); } catch {}
            channelRef.current = null;
        };
    }, [stream?.id, stream?.host_id, user?.id]);

    /*
      Comments and gifts.

      Realtime is not currently enabled on live_comments or live_gifts in this
      project, so in practice everything arrives on the poll below. At the old
      eight seconds a live chat was unusable — you spoke, and the room answered
      the better part of a minute later. 2.5s while the stream is running is the
      compromise: responsive enough to feel like a conversation, and it stops
      entirely once the stream ends rather than polling a dead room forever.

      The subscription stays because it costs nothing when the table is not
      published, and it takes over the moment Realtime is switched on — see
      supabase/migrations/20260808_090_realtime_calls_and_live.sql.
    */
    const streamEnded = stream?.is_active === false;
    useEffect(() => {
        if (streamEnded) return undefined;
        const poll = window.setInterval(loadLive, 2500);
        let channel = null;
        try {
            if (isSupabaseConfigured()) {
                const supabase = createBrowserSupabaseClient();
                channel = supabase
                    .channel(`gs-live-${id}`)
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_comments', filter: `stream_id=eq.${id}` }, (payload) => {
                        setComments((items) => (
                            items.some((item) => item.id === payload.new?.id) ? items : [...items.slice(-80), payload.new]
                        ));
                    })
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_gifts', filter: `stream_id=eq.${id}` }, (payload) => {
                        setGifts((items) => (
                            items.some((item) => item.id === payload.new?.id) ? items : [payload.new, ...items].slice(0, 80)
                        ));
                    })
                    .subscribe();
            }
        } catch {}
        return () => {
            window.clearInterval(poll);
            try { if (channel) createBrowserSupabaseClient().removeChannel(channel); } catch {}
        };
    }, [id, streamEnded]);

    useEffect(() => {
        gifts.forEach((gift) => {
            if (!gift?.id || seenGiftIdsRef.current.has(gift.id)) return;
            seenGiftIdsRef.current.add(gift.id);
            // A gift arriving over Realtime is the raw row, which carries no
            // artwork; one fetched through /api/live has been enriched. Handle both.
            triggerGiftEffect({ name: gift.gift_name, icon_url: gift.gift_visual || '', credit_cost: gift.credit_cost ?? 0 });
        });
    }, [gifts]);

    // Keep the chat pinned to the newest line as comments arrive.
    useEffect(() => {
        const box = chatRef.current;
        if (box) box.scrollTop = box.scrollHeight;
    }, [comments.length]);

    async function sendComment(event) {
        event.preventDefault();
        if (!user?.id) {
            setStatus('Sign in to join the live chat.');
            return;
        }
        if (!text.trim()) return;
        const body = text.trim();
        setText('');
        const res = await fetch('/api/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send_comment', streamId: id, userId: user.id, content: body }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            setStatus(data.error || 'Comment failed.');
            return;
        }
        /*
          The optimistic echo has to use the same field the list reads.

          It wrote `content` while the list renders `comment.body`, so your own
          message appeared as your name followed by nothing until the next poll
          replaced it. The column is `body`; that is what goes in here.
        */
        setComments((items) => [...items.slice(-80), { ...(data.comment || {}), id: data.comment?.id || `${Date.now()}`, body, user: { display_name: user.display_name || 'You' } }]);
        loadLive();
    }

    async function sendGift(gift) {
        if (!user?.id) return;
        const res = await fetch('/api/live', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send_gift', streamId: id, userId: user.id, giftId: gift.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            setStatus(data.error || 'Gift failed.');
            return;
        }
        triggerGiftEffect(data.catalogGift || gift);
        setGiftPanelOpen(false);
        loadLive();
    }

    function addHeart() {
        const heart = { id: `${Date.now()}-${Math.random()}`, left: 55 + Math.random() * 35 };
        setHearts((items) => [...items, heart]);
        window.setTimeout(() => setHearts((items) => items.filter((item) => item.id !== heart.id)), 1900);
        if (user?.id) {
            setStream((current) => current ? { ...current, total_likes: Number(current.total_likes || 0) + 1 } : current);
            fetch('/api/live', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'like_stream', streamId: id, userId: user.id }),
            })
                .then((res) => res.json().catch(() => ({})))
                .then((data) => {
                    if (Number.isFinite(Number(data.totalLikes))) {
                        setStream((current) => current ? { ...current, total_likes: Number(data.totalLikes) } : current);
                    }
                })
                .catch(() => {});
        }
    }

    const host = stream?.host || {};
    const hostPhoto = host.avatar_url || host.photos?.[0] || '';

    return (
        <div className="min-h-dvh bg-gray-950 text-white">
            <div className="relative min-h-dvh overflow-hidden" onDoubleClick={addHeart}>
                {/*
                  Backdrop, then broadcast, then scrim.

                  The pink and teal radial wash used to be painted after the
                  video, so it tinted the host's actual picture: every stream
                  came through with coloured blotches over the middle of it.
                  Both decorative layers now sit behind the video, where they
                  only show while there is nothing to broadcast, and a plain
                  dark scrim over the top carries the text.
                */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-teal-950 to-rose-950" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(240,68,114,.28),transparent_30%),radial-gradient(circle_at_70%_70%,rgba(14,143,131,.32),transparent_34%)]" />
                <video ref={remoteVideoRef} autoPlay playsInline onClick={() => remoteVideoRef.current?.play?.().catch(() => {})} className="absolute inset-0 h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/55" />
                {hearts.map((heart) => <span key={heart.id} className="pointer-events-none absolute bottom-24 text-3xl animate-[float_1.9s_ease-out_forwards]" style={{ left: `${heart.left}%` }}>♥</span>)}

                {/*
                  The header carries the three things a viewer wants on sight:
                  who is broadcasting, that it is live right now, and how many
                  other people are here. Everything else moved out of the way.
                */}
                <header className="relative z-10 flex items-center gap-3 p-4">
                    <Link href="/live" aria-label="Back to live streams" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/45 backdrop-blur"><ArrowLeft size={19} /></Link>
                    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full bg-black/45 py-1.5 pl-1.5 pr-4 backdrop-blur">
                        <UserAvatar name={host.display_name || 'Member'} src={hostPhoto} size={40} />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">{host.display_name || 'Member'}</p>
                            <p className="truncate type-caption text-white/70">{stream?.title || 'Live now'}</p>
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-danger px-2.5 py-1 text-[11px] font-black uppercase tracking-wide">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
                            <Users size={11} /> {stream?.viewer_count || 0}
                        </span>
                    </div>
                </header>

                <main className="relative z-10 flex min-h-[calc(100dvh-160px)] flex-col justify-end p-4">
                    {status && <p className="mb-3 rounded-2xl bg-white/15 p-3 text-xs font-bold">{status}</p>}
                    {/*
                      One quiet line instead of five boxes.

                      The counters were a grid of tiles in 10px type, which is
                      below the size anything should be read at, and two of the
                      five repeated the duration and viewer count already in the
                      header. They sit in a single row now, out of the way of the
                      broadcast, at a size that can actually be read.
                    */}
                    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 type-caption text-white/75">
                        <span className="inline-flex items-center gap-1.5"><Clock size={13} /> {formatDuration(seconds)}</span>
                        <span className="inline-flex items-center gap-1.5"><Eye size={13} /> {stream?.total_views || 0}</span>
                        <span className="inline-flex items-center gap-1.5"><Heart size={13} /> {stream?.total_likes || 0}</span>
                        <span className="inline-flex items-center gap-1.5"><MessageCircle size={13} /> {stream?.total_comments ?? comments.length}</span>
                        <span className="inline-flex items-center gap-1.5"><Gift size={13} /> {stream?.total_gifts ?? gifts.length}</span>
                    </div>
                    {/* The chat holds itself at the newest message. It used to
                        stay wherever it was, so arriving comments scrolled out
                        of sight and the stream looked dead. */}
                    <div ref={chatRef} className="max-h-64 space-y-2 overflow-auto pb-3">
                        {comments.slice(-40).map((comment) => (
                            <p key={comment.id} className="w-fit max-w-[88%] rounded-2xl bg-black/45 px-3 py-2 text-xs backdrop-blur">
                                <b className="text-white/70">{comment.user?.display_name || 'Member'}</b>{' '}
                                <span className="text-white">{comment.body}</span>
                            </p>
                        ))}
                    </div>
                    {giftPanelOpen && <div className="mb-3 rounded-3xl bg-white p-3 text-text-primary shadow-2xl">
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-bold">Send Live Gift</p>
                            <Link href="/wallet" className="text-xs font-semibold text-primary inline-flex items-center gap-1"><Wallet size={12} /> Credits</Link>
                        </div>
                        <div className="grid max-h-60 grid-cols-3 gap-2 overflow-auto">
                            {giftCatalog.length === 0 ? <p className="col-span-3 rounded-2xl bg-gray-50 p-3 text-xs font-bold text-text-muted">No active gifts yet. Add credits or ask admin to activate gifts.</p> : giftCatalog.map((gift) => <button key={gift.id} onClick={() => sendGift(gift)} className="rounded-2xl bg-gray-50 p-2 text-center"><GiftVisual gift={gift} className="mb-1 h-16 w-full rounded-xl" /><span className="block truncate text-[10px] font-semibold">{gift.name}</span><span className="text-[9px] font-semibold text-primary">{gift.credit_cost} cr</span></button>)}
                        </div>
                    </div>}
                    <form onSubmit={sendComment} className="flex items-center gap-2">
                        <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Say something..." className="min-w-0 flex-1 rounded-2xl bg-white/95 px-4 py-3 text-sm text-text-primary" />
                        <button className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15"><Send size={17} /></button>
                        <button type="button" onClick={addHeart} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500"><Heart size={17} fill="currentColor" /></button>
                        <button type="button" onClick={() => setGiftPanelOpen((open) => !open)} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400 text-gray-950"><Gift size={17} /></button>
                    </form>
                </main>
            </div>
        </div>
    );
}
