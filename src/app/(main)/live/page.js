'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Clock, Eye, Gift, Lock, MessageCircle, Radio, Sparkles, Users, Video, X } from '@/components/icons';
import { useAuth } from '@/contexts/AuthContext';
import UserAvatar from '@/components/UserAvatar';
import { createBrowserSupabaseClient, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useEntitlements } from '@/lib/useEntitlements';
import { POLL } from '@/lib/usePolling';

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
];

const AUDIO_CONSTRAINTS = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 48000,
    sampleSize: 16,
};

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

function elapsedSeconds(startedAt, fallback = 0) {
    const started = startedAt ? new Date(startedAt).getTime() : 0;
    if (!started || Number.isNaN(started)) return fallback;
    return Math.max(0, Math.floor((Date.now() - started) / 1000));
}

export default function LivePage() {
    const { user } = useAuth();
    const { features, loading: entitlementsLoading } = useEntitlements(user?.id);
    const canGoLive = features.live;
    const [streams, setStreams] = useState([]);
    const [title, setTitle] = useState('');
    const [activeStream, setActiveStream] = useState(null);
    const [status, setStatus] = useState('');
    const [seconds, setSeconds] = useState(0);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const channelRef = useRef(null);
    const peerConnectionsRef = useRef(new Map());

    async function loadStreams() {
        try {
            const res = await fetch('/api/live');
            const data = await res.json().catch(() => ({}));
            if (res.ok) setStreams(data.streams || []);
        } catch {}
    }

    async function loadActiveStream(streamId = activeStream?.id) {
        if (!streamId) return;
        try {
            const res = await fetch(`/api/live?streamId=${encodeURIComponent(streamId)}`);
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.stream?.id) {
                setActiveStream(data.stream);
                setSeconds(elapsedSeconds(data.stream.started_at, seconds));
            }
        } catch {}
    }

    useEffect(() => {
        loadStreams();
        const timer = window.setInterval(loadStreams, POLL.liveStrip);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!activeStream) return;
        const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
        return () => window.clearInterval(timer);
    }, [activeStream?.id]);

    useEffect(() => {
        if (!activeStream?.id) return undefined;
        const timer = window.setInterval(() => {
            loadActiveStream(activeStream.id);
            loadStreams();
        }, 5000);
        return () => window.clearInterval(timer);
    }, [activeStream?.id]);

    /*
      Report in while broadcasting.

      The server closes any stream that stops beating for 90 seconds, which is how
      a host who closed the tab stops appearing in Live Now. 25 seconds leaves room
      for two missed beats. If the server replies that the stream is no longer
      live — it was swept, or ended from another device — the page stops pretending
      and releases the camera.
    */
    useEffect(() => {
        if (!activeStream?.id) return undefined;
        let cancelled = false;

        async function beat() {
            try {
                const res = await fetch('/api/live', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'heartbeat', streamId: activeStream.id }),
                });
                const data = await res.json().catch(() => ({}));
                if (cancelled || !res.ok) return;
                if (data.live === false) {
                    streamRef.current?.getTracks?.().forEach((track) => track.stop());
                    streamRef.current = null;
                    setActiveStream(null);
                    setStatus('This live stream was closed. Start a new one when you are ready.');
                }
            } catch {
                // A dropped beat is not fatal; the next one covers it.
            }
        }

        const timer = window.setInterval(beat, POLL.liveHeartbeat);
        return () => { cancelled = true; window.clearInterval(timer); };
    }, [activeStream?.id]);

    /*
      Closing the tab is the common way a stream ends, and it skips End Live. The
      heartbeat sweep catches it within 90 seconds, but a keepalive beacon ends it
      immediately when the browser allows one.
    */
    useEffect(() => {
        if (!activeStream?.id) return undefined;
        function onLeave() {
            try {
                const payload = JSON.stringify({ action: 'end_stream', streamId: activeStream.id });
                navigator.sendBeacon?.('/api/live', new Blob([payload], { type: 'application/json' }));
            } catch {}
        }
        window.addEventListener('pagehide', onLeave);
        return () => window.removeEventListener('pagehide', onLeave);
    }, [activeStream?.id]);

    useEffect(() => {
        if (!activeStream?.id || !user?.id || !streamRef.current || !isSupabaseConfigured()) return undefined;
        const supabase = createBrowserSupabaseClient();
        const channel = supabase.channel(`gs-live-webrtc-${activeStream.id}`, { config: { broadcast: { self: false } } });
        channelRef.current = channel;

        async function sendSignal(event, payload) {
            await channel.send({ type: 'broadcast', event, payload }).catch(() => {});
        }

        async function createOfferForViewer(viewerId) {
            if (!viewerId || viewerId === user.id || peerConnectionsRef.current.has(viewerId)) return;
            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            peerConnectionsRef.current.set(viewerId, pc);
            streamRef.current?.getTracks?.().forEach((track) => pc.addTrack(track, streamRef.current));
            pc.onicecandidate = (event) => {
                if (event.candidate) sendSignal('host-ice', { to: viewerId, from: user.id, candidate: event.candidate.toJSON() });
            };
            pc.onconnectionstatechange = () => {
                if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
                    try { pc.close(); } catch {}
                    peerConnectionsRef.current.delete(viewerId);
                }
            };
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await sendSignal('host-offer', { to: viewerId, from: user.id, offer });
        }

        channel
            .on('broadcast', { event: 'viewer-ready' }, ({ payload }) => {
                if (payload?.streamId === activeStream.id) createOfferForViewer(payload.viewerId);
            })
            .on('broadcast', { event: 'viewer-answer' }, async ({ payload }) => {
                if (payload?.to !== user.id) return;
                const pc = peerConnectionsRef.current.get(payload.from);
                if (pc && payload.answer && !pc.currentRemoteDescription) {
                    await pc.setRemoteDescription(new RTCSessionDescription(payload.answer)).catch(() => {});
                }
            })
            .on('broadcast', { event: 'viewer-ice' }, async ({ payload }) => {
                if (payload?.to !== user.id) return;
                const pc = peerConnectionsRef.current.get(payload.from);
                if (pc && payload.candidate) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
            })
            .on('broadcast', { event: 'viewer-left' }, ({ payload }) => {
                const pc = peerConnectionsRef.current.get(payload?.viewerId);
                try { pc?.close(); } catch {}
                peerConnectionsRef.current.delete(payload?.viewerId);
            })
            .subscribe((state) => {
                if (state === 'SUBSCRIBED') setStatus('Live signaling is ready. Viewers can receive your stream.');
            });

        return () => {
            peerConnectionsRef.current.forEach((pc) => { try { pc.close(); } catch {} });
            peerConnectionsRef.current.clear();
            try { supabase.removeChannel(channel); } catch {}
            channelRef.current = null;
        };
    }, [activeStream?.id, user?.id]);

    async function startPreview() {
        if (streamRef.current) return streamRef.current;
        if (!navigator.mediaDevices?.getUserMedia) {
            setStatus('Camera and microphone are not available on this device.');
            return null;
        }
        try {
            setStatus('Your device will ask for camera and microphone access.');
            window.dispatchEvent(new CustomEvent('gs-media-permission-requested', { detail: { source: 'live', video: true } }));
            const media = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
                audio: AUDIO_CONSTRAINTS,
            });
            streamRef.current = media;
            if (videoRef.current) videoRef.current.srcObject = media;
            setStatus('Preview is ready. Tap Go Live to get featured.');
            return media;
        } catch (error) {
            const name = error?.name || '';
            if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
                setStatus('Camera or microphone is blocked. Open GS App permissions on your device and allow Camera and Microphone, then try again.');
            } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
                setStatus('No camera or microphone was found on this device.');
            } else {
                setStatus('Camera or microphone could not start. Close other apps using them, then try again.');
            }
            return null;
        }
    }

    async function goLive() {
        if (!user?.id) return;
        const media = await startPreview();
        if (!media) return;
        const res = await fetch('/api/live', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'start_stream', userId: user.id, title: title || `${user.display_name || 'Member'} is live` }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            setStatus(data.error || 'Could not start live.');
            return;
        }
        setSeconds(0);
        setActiveStream(data.stream);
        setStatus('You are live and featured in the Live Now section. Keep this screen open while streaming.');
        loadStreams();
    }

    async function endLive() {
        if (!activeStream?.id || !user?.id) return;
        try {
            await channelRef.current?.send?.({ type: 'broadcast', event: 'stream-ended', payload: { streamId: activeStream.id, hostId: user.id } });
        } catch {}
        await fetch('/api/live', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'end_stream', userId: user.id, streamId: activeStream.id }),
        });
        streamRef.current?.getTracks?.().forEach((track) => track.stop());
        peerConnectionsRef.current.forEach((pc) => { try { pc.close(); } catch {} });
        peerConnectionsRef.current.clear();
        streamRef.current = null;
        setActiveStream(null);
        setStatus(`Live ended. Duration ${formatDuration(seconds)}.`);
        loadStreams();
    }

    return (
        <div className="px-4 py-4 pb-28 space-y-5">
            <section className="rounded-3xl overflow-hidden relative min-h-[360px]" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover bg-gray-900" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/45" />
                <div className="relative z-10 p-4 min-h-[360px] flex flex-col justify-between text-white">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-white/70">GS Live</p>
                            <h1 className="text-2xl font-black">{activeStream ? 'You are live' : 'Go Live'}</h1>
                        </div>
                        {activeStream && <span className="rounded-full bg-danger px-3 py-1 text-xs font-semibold">LIVE {formatDuration(seconds)}</span>}
                    </div>
                    {!activeStream ? (
                        canGoLive ? (
                            <div className="space-y-3">
                                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Live title" className="w-full rounded-2xl px-4 py-3 text-sm text-text-primary" />
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={startPreview} className="min-h-[44px] rounded-2xl bg-white/15 py-3 text-sm font-bold backdrop-blur flex items-center justify-center gap-2"><Video size={16} /> Preview</button>
                                    <button onClick={goLive} className="min-h-[44px] rounded-2xl py-3 text-sm font-bold text-white gradient-primary flex items-center justify-center gap-2"><Radio size={16} /> Go Live</button>
                                </div>
                                <p className="rounded-2xl bg-white/10 p-3 text-xs font-bold text-white/85"><Sparkles size={13} className="mr-1 inline" /> Live hosts appear in Live Now and at the top of Discover while the stream is active.</p>
                            </div>
                        ) : (
                            /*
                              Hosting is Silver and Gold only, and the server returns
                              402 to anyone else. Showing the button anyway meant a
                              Basic member granted camera access, waited, and then hit
                              a refusal — so the gate is stated up front instead, with
                              the way to clear it. Watching stays open to everyone.
                            */
                            <div className="space-y-3">
                                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                                    <p className="flex items-center gap-2 text-sm font-black"><Lock size={15} /> Hosting is a premium feature</p>
                                    <p className="mt-1.5 text-xs text-white/80">
                                        {entitlementsLoading
                                            ? 'Checking your package…'
                                            : 'Go Live is included with Silver and Gold. You can watch any stream below on your current package.'}
                                    </p>
                                </div>
                                {!entitlementsLoading && (
                                    <Link href="/packages" className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white gradient-primary">
                                        <Radio size={16} /> Upgrade to go live
                                    </Link>
                                )}
                            </div>
                        )
                    ) : (
                        <button onClick={endLive} className="rounded-2xl bg-danger py-3 text-sm font-bold text-white flex items-center justify-center gap-2"><X size={16} /> End Live</button>
                    )}
                </div>
            </section>

            {status && <div className="rounded-2xl bg-primary/10 p-3 text-xs font-bold text-primary">{status}</div>}

            {activeStream && (
                <section className="grid grid-cols-2 gap-2 md:grid-cols-6">
                    {[
                        ['Time', formatDuration(seconds), Clock],
                        ['Watching', activeStream.viewer_count || 0, Users],
                        ['Views', activeStream.total_views || 0, Eye],
                        ['Likes', activeStream.total_likes || 0, Sparkles],
                        ['Comments', activeStream.total_comments || 0, MessageCircle],
                        ['Gifts', activeStream.total_gifts || 0, Gift],
                    ].map(([label, value, Icon]) => (
                        <div key={label} className="rounded-2xl p-3" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                            <p className="flex items-center gap-1 text-[10px] font-semibold text-text-muted"><Icon size={12} /> {label}</p>
                            <p className="text-lg font-black text-primary">{value}</p>
                        </div>
                    ))}
                </section>
            )}

            <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-text-primary">Live Now</h2>
                    <button onClick={loadStreams} className="text-xs font-semibold text-primary">Refresh</button>
                </div>
                {streams.length === 0 ? <p className="rounded-2xl p-4 text-sm text-text-muted" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>No one is live right now.</p> : (
                    <div className="grid gap-3">
                        {streams.map((stream) => {
                            const host = stream.host || {};
                            const photo = host.avatar_url || host.photos?.[0] || '';
                            return (
                                <Link href={`/live/${stream.id}`} key={stream.id} className="rounded-2xl p-3 flex items-center gap-3" style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}>
                                    <UserAvatar name={host.display_name || 'Member'} src={photo} size={52} />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold text-text-primary">{stream.title || 'GS Live'}</p>
                                        <p className="truncate text-xs text-text-muted">{host.display_name || 'Member'} - {formatDuration(elapsedSeconds(stream.started_at))}</p>
                                        <p className="truncate text-[10px] text-text-muted">{stream.total_views || 0} views - {stream.total_likes || 0} likes - {stream.total_comments || 0} comments - {stream.total_gifts || 0} gifts</p>
                                    </div>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-1 text-[10px] font-semibold text-danger"><Users size={11} /> {stream.viewer_count || 0}</span>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}
