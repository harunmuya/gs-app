'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageCircle, Mic, MicOff, Phone, PhoneOff, RefreshCw, Video, VideoOff } from '@/components/icons';
import { createBrowserSupabaseClient, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import PermissionSheet from '@/components/PermissionSheet';
import UserAvatar from '@/components/UserAvatar';
import { permissionState, wasDismissed } from '@/lib/permissions';
import { CANNOT_CALL_SELF } from '@/lib/copy';

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

const VIDEO_CONSTRAINTS = {
    facingMode: 'user',
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
};

function formatDuration(seconds) {
    const value = Math.max(0, Number(seconds || 0));
    const mins = Math.floor(value / 60);
    const secs = value % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function CallRoomPage({ params }) {
    const { id: peerId } = use(params);
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const [session, setSession] = useState(null);
    const [status, setStatus] = useState('Preparing call...');
    const [muted, setMuted] = useState(false);
    const [cameraOff, setCameraOff] = useState(false);
    const [callType, setCallType] = useState(searchParams.get('type') || 'voice');
    const [mediaWarning, setMediaWarning] = useState('');
    const [deviceInfo, setDeviceInfo] = useState({ checked: false, audioInputs: 0, videoInputs: 0 });
    const [duration, setDuration] = useState(0);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const pcRef = useRef(null);
    const localStreamRef = useRef(null);
    const handledSignalsRef = useRef(new Set());
    // Which permission still needs explaining before the OS is asked.
    const [askPermission, setAskPermission] = useState(null);
    /*
      Who is on the other end.

      The screen said "GS Call" and nothing else. On a video call you at least
      see a face; on a voice call it was a black rectangle with a status line,
      and nothing anywhere told you who you were speaking to or who was ringing.
      Every phone app in existence leads with the name and the photo, because
      that is the only thing the person actually needs to know.
    */
    const [peer, setPeer] = useState(null);
    const [remoteLive, setRemoteLive] = useState(false);

    const sessionIdFromUrl = searchParams.get('session');
    const role = searchParams.get('role') || (sessionIdFromUrl ? 'receiver' : 'caller');
    const acceptedFromUrl = searchParams.get('accept') === '1';
    const receiverId = role === 'caller' ? peerId : user?.id;
    const otherUserId = role === 'caller' ? peerId : peerId;

    /*
      Name and photo, from whichever source has them.

      The profile fetch is the best answer but arrives a moment later, so the
      session metadata (written when the call was created) covers the gap. A
      call screen that says Member briefly is still better than one that never
      says who it is.
    */
    const peerName = peer?.name
        || (role === 'caller' ? session?.metadata?.receiverName : session?.metadata?.callerName)
        || 'GS Member';
    // The members endpoint returns the photo as avatarUrl; photos is the gallery.
    const peerPhoto = peer?.avatarUrl || (Array.isArray(peer?.photos) ? peer.photos[0] : '') || '';

    useEffect(() => {
        if (!user?.id || !peerId) return;
        let stopped = false;

        async function setup() {
            try {
                if (user.id === peerId) {
                    setStatus(CANNOT_CALL_SELF);
                    return;
                }
                let activeSession = null;
                if (sessionIdFromUrl) {
                    const res = await fetch(`/api/calls?sessionId=${encodeURIComponent(sessionIdFromUrl)}`);
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data.error || 'Could not open call.');
                    activeSession = data.session;
                    setCallType(data.session.call_type || callType);
                    if (role === 'receiver' && activeSession.status === 'ringing' && !acceptedFromUrl) {
                        setSession(activeSession);
                        setStatus('Incoming call');
                        return;
                    }
                } else {
                    const res = await fetch('/api/calls', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'start', peerId, callType }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data.error || 'Could not start call.');
                    activeSession = data.session;
                }
                if (stopped) return;
                setSession(activeSession);
                await startMedia(activeSession);
            } catch (err) {
                setStatus(err.message || 'Call failed.');
            }
        }

        setup();
        return () => {
            stopped = true;
            cleanupCall();
        };
    }, [user?.id, peerId, sessionIdFromUrl]);

    // Load the other person's name and photo so the screen can say who this is.
    useEffect(() => {
        if (!peerId || String(peerId).startsWith('@')) return undefined;
        let alive = true;
        (async () => {
            try {
                const res = await fetch(`/api/members?id=${encodeURIComponent(peerId)}`, { cache: 'no-store' });
                const data = await res.json().catch(() => ({}));
                const found = (data.members || [])[0];
                if (alive && found) setPeer(found);
            } catch { /* the name falls back to the session metadata below */ }
        })();
        return () => { alive = false; };
    }, [peerId]);

    useEffect(() => {
        if (!['accepted', 'active'].includes(session?.status)) return;
        const started = session.started_at ? new Date(session.started_at).getTime() : Date.now();
        const tick = () => setDuration(Math.max(0, Math.floor((Date.now() - started) / 1000)));
        tick();
        const timer = window.setInterval(tick, 1000);
        return () => window.clearInterval(timer);
    }, [session?.id, session?.status, session?.started_at]);

    useEffect(() => {
        if (role !== 'caller' || session?.status !== 'ringing' || !session?.id) return;
        const timer = window.setTimeout(async () => {
            await updateStatus(session.id, 'missed');
            setStatus('No answer');
            cleanupCall();
        }, 60000);
        return () => window.clearTimeout(timer);
    }, [role, session?.id, session?.status]);

    /*
      Close the call if this tab goes away.

      Without this, a caller who navigates away or closes the tab leaves the row
      at 'ringing'. The receiver's device keeps showing the incoming-call sheet
      and keeps ringing until the stale sweep catches it — up to two minutes of
      a phone ringing for a caller who is no longer there. A keepalive beacon
      ends it at once; the sweep remains as the backstop for a crash or a lost
      network.
    */
    useEffect(() => {
        if (!session?.id || ['ended', 'declined', 'rejected', 'missed'].includes(session.status)) return undefined;
        function onLeave() {
            try {
                const status = session.status === 'ringing' && role === 'caller' ? 'missed' : 'ended';
                const payload = JSON.stringify({ action: 'status', sessionId: session.id, status });
                navigator.sendBeacon?.('/api/calls', new Blob([payload], { type: 'application/json' }));
            } catch {}
        }
        window.addEventListener('pagehide', onLeave);
        return () => window.removeEventListener('pagehide', onLeave);
    }, [session?.id, session?.status, role]);

    async function inspectMediaDevices() {
        if (!navigator.mediaDevices?.enumerateDevices) return { checked: false, audioInputs: 0, videoInputs: 0 };
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const next = {
                checked: true,
                audioInputs: devices.filter((device) => device.kind === 'audioinput').length,
                videoInputs: devices.filter((device) => device.kind === 'videoinput').length,
            };
            setDeviceInfo(next);
            return next;
        } catch {
            const next = { checked: false, audioInputs: 0, videoInputs: 0 };
            setDeviceInfo(next);
            return next;
        }
    }

    async function requestLocalMedia(wantsVideo) {
        if (!navigator.mediaDevices?.getUserMedia) {
            setMediaWarning('This device cannot open camera or microphone for secure calls.');
            return null;
        }
        const beforeDevices = await inspectMediaDevices();
        try {
            window.dispatchEvent(new CustomEvent('gs-media-permission-requested', { detail: { source: 'call', video: wantsVideo } }));
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: AUDIO_CONSTRAINTS,
                video: wantsVideo ? VIDEO_CONSTRAINTS : false,
            });
            await inspectMediaDevices();
            return stream;
        } catch (err) {
            const errorName = err?.name || '';
            if (wantsVideo) {
                try {
                    const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS, video: false });
                    setCameraOff(true);
                    setMediaWarning('Camera was not found, so this call opened with microphone only.');
                    await inspectMediaDevices();
                    return audioOnly;
                } catch {}
            }
            setMuted(true);
            setCameraOff(true);
            if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
                setMediaWarning('Camera or microphone is blocked. Open GS App permissions on your device and allow Camera and Microphone, then tap Retry.');
            } else if (beforeDevices.checked && beforeDevices.audioInputs === 0 && (!wantsVideo || beforeDevices.videoInputs === 0)) {
                setMediaWarning('No microphone or camera is visible to this device. Check your device permissions and connected accessories, then try again.');
            } else {
                setMediaWarning('Camera or microphone could not open. Close other apps using the device, allow permissions, then tap Retry.');
            }
            return null;
        }
    }

    async function acceptIncoming() {
        if (!session?.id) return;
        const updated = await updateStatus(session.id, 'accepted');
        await startMedia(updated || { ...session, status: 'accepted' });
    }

    async function declineIncoming() {
        if (!session?.id) return;
        await updateStatus(session.id, 'declined');
        cleanupCall();
        router.push('/messages');
    }

    async function startMedia(activeSession) {
        /*
          Explain before the browser asks.

          getUserMedia was previously called cold, so the member saw a bare
          system prompt from an app that had not said why it wanted their camera
          or microphone. A reflexive Block is remembered permanently by the
          browser, and from then on every call failed with "Camera or microphone
          could not open" and no route back except device settings.

          Only shown when the OS has not already decided — somebody who granted
          access last week is not asked again — and skipped if they dismissed the
          rationale recently, so a "not now" is respected rather than nagged.
        */
        const needsVideo = (activeSession.call_type || callType) === 'video';
        const needed = needsVideo ? 'camera' : 'microphone';
        const state = await permissionState(needed);
        if (state === 'prompt' && !wasDismissed(needed)) {
            setAskPermission({ kind: needed, session: activeSession });
            setStatus(needsVideo ? 'Camera and microphone needed' : 'Microphone needed');
            return;
        }

        setStatus('Opening secure call room...');
        setMediaWarning('');
        const videoEnabled = (activeSession.call_type || callType) === 'video';
        const stream = await requestLocalMedia(videoEnabled);
        localStreamRef.current = stream;
        if (stream && localVideoRef.current) localVideoRef.current.srcObject = stream;

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;
        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            if (state === 'connected' || state === 'completed') setStatus('Connected');
            else if (state === 'disconnected') setStatus('Connection lost. Reconnecting...');
            else if (state === 'failed') setStatus('Connection failed. Tap Retry.');
        };
        if (stream?.getTracks?.().length) {
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        } else {
            try {
                pc.addTransceiver('audio', { direction: 'recvonly' });
                if (videoEnabled) pc.addTransceiver('video', { direction: 'recvonly' });
            } catch {}
        }
        pc.ontrack = (event) => {
            // Only a video track should hide the identity layer; an audio only
            // stream still needs the name and photo on screen.
            if (event.track?.kind === 'video') setRemoteLive(true);
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
                remoteVideoRef.current.muted = false;
                remoteVideoRef.current.volume = 1;
                remoteVideoRef.current.play?.().catch(() => {
                    setMediaWarning('Tap the call screen once if remote voice does not start automatically.');
                });
            }
        };
        pc.onicecandidate = (event) => {
            if (event.candidate) sendSignal(activeSession, 'ice', event.candidate.toJSON());
        };

        if (role === 'caller') {
            setStatus(stream ? 'Calling...' : 'Call room open. Waiting for device permission...');
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await sendSignal(activeSession, 'offer', offer);
        } else {
            setStatus(stream ? 'Incoming call. Waiting for caller signal...' : 'Incoming call open. Waiting for device permission...');
            await updateStatus(activeSession.id, 'accepted');
        }
        subscribeSignals(activeSession);
    }

    async function sendSignal(activeSession, signalType, payload) {
        await fetch('/api/calls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'signal',
                sessionId: activeSession.id,
                userId: user.id,
                receiverId: role === 'caller' ? peerId : activeSession.caller_id,
                signalType,
                payload,
            }),
        });
    }

    async function handleSignal(signal) {
        if (!signal?.id || handledSignalsRef.current.has(signal.id) || signal.sender_id === user.id) return;
        handledSignalsRef.current.add(signal.id);
        const pc = pcRef.current;
        if (!pc) return;
        if (signal.signal_type === 'offer') {
            setStatus('Connecting...');
            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendSignal(session || { id: signal.call_session_id, caller_id: signal.sender_id }, 'answer', answer);
            await updateStatus(signal.call_session_id, 'active');
        }
        if (signal.signal_type === 'answer') {
            setStatus('Connected');
            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
            await updateStatus(signal.call_session_id, 'active');
        }
        if (signal.signal_type === 'ice' && signal.payload) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.payload)).catch(() => {});
        }
    }

    function subscribeSignals(activeSession) {
        // Signals must be applied in the order they were written: an ICE
        // candidate added before setRemoteDescription has resolved is discarded.
        // `.forEach(handleSignal)` fired them all concurrently, so candidates
        // routinely raced ahead of the offer and were dropped.
        let draining = false;
        async function drain(signals) {
            if (draining) return;
            draining = true;
            try {
                for (const signal of signals) await handleSignal(signal);
            } finally {
                draining = false;
            }
        }

        async function poll() {
            const res = await fetch(`/api/calls?sessionId=${encodeURIComponent(activeSession.id)}`);
            const data = await res.json().catch(() => ({}));
            await drain(data.signals || []);
            if (data.session?.status) {
                setSession(data.session);
                if (role === 'caller' && ['declined', 'rejected', 'missed', 'ended'].includes(data.session.status)) {
                    setStatus(`Call ${data.session.status}.`);
                    cleanupCall();
                }
            }
        }
        poll();
        // Poll hard while the handshake is outstanding, then back off. At the old
        // flat 8s a call took the better part of a minute to negotiate, which
        // reads as a call that simply does not work. Realtime usually beats the
        // poll to it; this is the fallback when Realtime is unavailable.
        let interval = window.setInterval(poll, 1200);
        const backoff = window.setTimeout(() => {
            window.clearInterval(interval);
            interval = window.setInterval(poll, 5000);
        }, 30000);
        let channel = null;
        try {
            if (isSupabaseConfigured()) {
                const supabase = createBrowserSupabaseClient();
                channel = supabase
                    .channel(`gs-call-${activeSession.id}`)
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_signals', filter: `call_session_id=eq.${activeSession.id}` }, (payload) => handleSignal(payload.new))
                    .subscribe();
            }
        } catch {}
        pcRef.current.__cleanupSignals = () => {
            window.clearInterval(interval);
            window.clearTimeout(backoff);
            try { if (channel) createBrowserSupabaseClient().removeChannel(channel); } catch {}
        };
    }

    async function updateStatus(sessionId, nextStatus) {
        if (!sessionId) return;
        const res = await fetch('/api/calls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'status', sessionId, status: nextStatus }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.session) setSession(data.session);
        return data.session || null;
    }

    function cleanupCall() {
        try { pcRef.current?.__cleanupSignals?.(); } catch {}
        try { pcRef.current?.close(); } catch {}
        localStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    }

    async function endCall(nextStatus = 'ended') {
        await updateStatus(session?.id, nextStatus);
        cleanupCall();
        router.push('/messages');
    }

    async function retryMedia() {
        if (!session?.id) return;
        cleanupCall();
        handledSignalsRef.current = new Set();
        setMuted(false);
        setCameraOff(false);
        setMediaWarning('');
        await startMedia(session);
    }

    function toggleMute() {
        if (!localStreamRef.current?.getAudioTracks?.().length) {
            setStatus('No microphone is available on this device.');
            return;
        }
        const next = !muted;
        localStreamRef.current?.getAudioTracks?.().forEach((track) => { track.enabled = !next; });
        setMuted(next);
    }

    function toggleCamera() {
        if (!localStreamRef.current?.getVideoTracks?.().length) {
            setStatus('No camera is available on this device.');
            return;
        }
        const next = !cameraOff;
        localStreamRef.current?.getVideoTracks?.().forEach((track) => { track.enabled = !next; });
        setCameraOff(next);
    }

    return (
        <div className="min-h-dvh bg-gray-950 text-white flex flex-col">
            {/* Shown in place of the bare OS prompt. On allow, the call picks up
                exactly where it paused; on decline, the room stays open so the
                member can retry or switch to messaging. */}
            {askPermission && (
                <PermissionSheet
                    permission={askPermission.kind}
                    onResolved={() => {
                        const pending = askPermission.session;
                        setAskPermission(null);
                        startMedia(pending);
                    }}
                    onClose={() => {
                        setAskPermission(null);
                        setStatus('Call needs camera and microphone access. Tap Retry when you are ready.');
                        setMediaWarning('This call cannot connect without microphone access.');
                    }}
                />
            )}
            <main className="relative flex-1 overflow-hidden">
                <video ref={remoteVideoRef} autoPlay playsInline onClick={() => remoteVideoRef.current?.play?.().catch(() => {})} className="absolute inset-0 w-full h-full object-cover bg-gray-900" />

                {/* The scrim sits on the video and nothing else. It used to be
                    painted last, which meant it dimmed every layer above it. */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

                {/*
                  The identity layer.

                  Shown whenever there is no remote video to look at, which is
                  every voice call and the whole of the connecting phase on a
                  video one. Without it the screen was black with the words
                  "GS Call", so a member answering had no idea who was on the
                  line until somebody spoke.
                */}
                {!remoteLive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8">
                        <div className="relative">
                            <UserAvatar name={peerName} src={peerPhoto} size={132} className="ring-4 ring-white/15" />
                            {/* A quiet pulse while ringing, so a still screen does not read as frozen. */}
                            {session?.status === 'ringing' && (
                                <span className="absolute inset-0 animate-ping rounded-full ring-2 ring-white/25" />
                            )}
                        </div>
                        <div className="text-center">
                            <h1 className="type-display text-white">{peerName}</h1>
                            <p className="mt-1 type-body text-white/70">
                                {callType === 'video' ? 'Video call' : 'Voice call'}
                                {['accepted', 'active'].includes(session?.status) ? ` · ${formatDuration(duration)}` : ''}
                            </p>
                        </div>
                    </div>
                )}

                {/* The self view belongs on a video call only. On a voice call it
                    was a black rectangle pinned to the corner for no reason. */}
                {callType === 'video' && (
                    <video ref={localVideoRef} autoPlay muted playsInline className="absolute right-4 top-4 h-40 w-28 rounded-2xl border border-white/20 bg-black object-cover" />
                )}

                <div className="absolute left-4 right-4 top-5">
                    {/* Once video is flowing the name moves up here, so it never
                        covers the person you are looking at. */}
                    {remoteLive && (
                        <>
                            <h1 className="type-title text-white">{peerName}</h1>
                            <p className="type-caption text-white/70">{formatDuration(duration)}</p>
                        </>
                    )}
                    <p className="mt-1 type-caption text-white/75">{status}</p>
                    {mediaWarning && <div className="mt-3 max-w-sm space-y-2 rounded-2xl bg-amber-400/20 px-3 py-3 text-xs font-bold text-amber-100">
                        <p>{mediaWarning}</p>
                        <p className="text-white/70">Detected: {deviceInfo.checked ? `${deviceInfo.audioInputs} mic, ${deviceInfo.videoInputs} camera` : 'device check unavailable'}</p>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={retryMedia} className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-white/15 px-3 py-2 text-white"><RefreshCw size={13} /> Retry</button>
                            <button onClick={() => router.push(`/messages/${peerId}`)} className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-white/15 px-3 py-2 text-white"><MessageCircle size={13} /> Message</button>
                        </div>
                    </div>}
                </div>
            </main>

            {/*
              Answering.

              This was a small translucent card floated over the top left corner,
              with Decline first and a line of copy that mentioned Supabase call
              records to the member. It now answers from the bottom of the screen
              where a thumb already is, with Accept on the right, the way every
              phone has done it for fifteen years.
            */}
            {role === 'receiver' && session?.status === 'ringing' && (
                <footer className="bg-black px-6 pb-8 pt-5">
                    <p className="text-center type-caption text-white/60">
                        Incoming {callType === 'video' ? 'video' : 'voice'} call
                    </p>
                    <div className="mx-auto mt-4 flex max-w-sm items-center justify-between gap-6">
                        <button
                            type="button"
                            onClick={declineIncoming}
                            aria-label="Decline the call"
                            className="flex flex-1 flex-col items-center gap-2"
                        >
                            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-danger text-white shadow-lg shadow-black/50">
                                <PhoneOff size={26} />
                            </span>
                            <span className="type-caption text-white/70">Decline</span>
                        </button>
                        <button
                            type="button"
                            onClick={acceptIncoming}
                            aria-label="Accept the call"
                            className="flex flex-1 flex-col items-center gap-2"
                        >
                            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success text-white shadow-lg shadow-black/50">
                                {callType === 'video' ? <Video size={26} /> : <Phone size={26} />}
                            </span>
                            <span className="type-caption text-white/70">Accept</span>
                        </button>
                    </div>
                </footer>
            )}
            {/*
              The control bar.

              Three unlabelled grey circles told you nothing about what they did
              or which state they were in: a muted mic and a live mic sat in the
              same grey, distinguishable only by a small glyph. Each control now
              carries a word underneath, an aria-label, and a fill that changes
              when it is switched on, so mute reads as mute at a glance.
            */}
            {!(role === 'receiver' && session?.status === 'ringing') && <footer className="flex items-center justify-center gap-6 bg-black px-5 pb-8 pt-5">
                <button
                    type="button"
                    onClick={toggleMute}
                    aria-pressed={muted}
                    aria-label={muted ? 'Unmute your microphone' : 'Mute your microphone'}
                    className="flex w-20 flex-col items-center gap-2"
                >
                    <span className={`flex h-14 w-14 items-center justify-center rounded-full transition ${muted ? 'bg-white text-gray-950' : 'bg-white/10 text-white'}`}>
                        {muted ? <MicOff size={22} /> : <Mic size={22} />}
                    </span>
                    <span className="type-caption text-white/70">{muted ? 'Unmute' : 'Mute'}</span>
                </button>

                {callType === 'video' && (
                    <button
                        type="button"
                        onClick={toggleCamera}
                        aria-pressed={cameraOff}
                        aria-label={cameraOff ? 'Turn your camera on' : 'Turn your camera off'}
                        className="flex w-20 flex-col items-center gap-2"
                    >
                        <span className={`flex h-14 w-14 items-center justify-center rounded-full transition ${cameraOff ? 'bg-white text-gray-950' : 'bg-white/10 text-white'}`}>
                            {cameraOff ? <VideoOff size={22} /> : <Video size={22} />}
                        </span>
                        <span className="type-caption text-white/70">{cameraOff ? 'Camera on' : 'Camera off'}</span>
                    </button>
                )}

                <button
                    type="button"
                    onClick={() => endCall('ended')}
                    aria-label="End the call"
                    className="flex w-20 flex-col items-center gap-2"
                >
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-danger text-white shadow-lg shadow-black/50">
                        <PhoneOff size={26} />
                    </span>
                    <span className="type-caption text-white/70">End</span>
                </button>
            </footer>}
        </div>
    );
}
