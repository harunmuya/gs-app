'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageCircle, Mic, MicOff, PhoneOff, RefreshCw, Video, VideoOff } from '@/components/icons';
import { createBrowserSupabaseClient, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import PermissionSheet from '@/components/PermissionSheet';
import { permissionState, wasDismissed } from '@/lib/permissions';

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

    const sessionIdFromUrl = searchParams.get('session');
    const role = searchParams.get('role') || (sessionIdFromUrl ? 'receiver' : 'caller');
    const acceptedFromUrl = searchParams.get('accept') === '1';
    const receiverId = role === 'caller' ? peerId : user?.id;
    const otherUserId = role === 'caller' ? peerId : peerId;

    useEffect(() => {
        if (!user?.id || !peerId) return;
        let stopped = false;

        async function setup() {
            try {
                if (user.id === peerId) {
                    setStatus('You cannot call yourself.');
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
                <video ref={localVideoRef} autoPlay muted playsInline className="absolute right-4 top-4 w-28 h-40 rounded-2xl object-cover bg-black border border-white/20" />
                <div className="absolute left-4 right-4 top-5">
                    <p className="text-xs uppercase tracking-wide text-white/70">{callType === 'video' ? 'Video Call' : 'Voice Call'}</p>
                    <h1 className="text-xl font-black">GS Call</h1>
                    <p className="text-sm text-white/75">{status}{['accepted', 'active'].includes(session?.status) ? ` · ${formatDuration(duration)}` : ''}</p>
                    {role === 'receiver' && session?.status === 'ringing' && <div className="mt-4 max-w-sm rounded-3xl bg-white/10 p-4 backdrop-blur-xl border border-white/15">
                        <p className="text-sm font-bold">Incoming {callType === 'video' ? 'video' : 'voice'} call</p>
                        <p className="mt-1 text-xs text-white/70">Answer inside GS App or decline the call. This call is handled through your app account and Supabase call records.</p>
                        <div className="mt-4 flex gap-3">
                            <button onClick={declineIncoming} className="h-12 flex-1 rounded-2xl bg-danger font-black text-white">Decline</button>
                            <button onClick={acceptIncoming} className="h-12 flex-1 rounded-2xl bg-success font-black text-white">Accept</button>
                        </div>
                    </div>}
                    {mediaWarning && <div className="mt-3 max-w-sm rounded-2xl bg-amber-400/20 px-3 py-3 text-xs font-bold text-amber-100 space-y-2">
                        <p>{mediaWarning}</p>
                        <p className="text-white/70">Detected: {deviceInfo.checked ? `${deviceInfo.audioInputs} mic, ${deviceInfo.videoInputs} camera` : 'device check unavailable'}</p>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={retryMedia} className="inline-flex items-center gap-1 rounded-xl bg-white/15 px-3 py-2 text-white"><RefreshCw size={13} /> Retry</button>
                            <button onClick={() => router.push(`/messages/${peerId}`)} className="inline-flex items-center gap-1 rounded-xl bg-white/15 px-3 py-2 text-white"><MessageCircle size={13} /> Message</button>
                        </div>
                    </div>}
                </div>
            </main>
            {!(role === 'receiver' && session?.status === 'ringing') && <footer className="p-5 flex items-center justify-center gap-4 bg-black">
                <button onClick={toggleMute} className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">{muted ? <MicOff /> : <Mic />}</button>
                {callType === 'video' && <button onClick={toggleCamera} className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">{cameraOff ? <VideoOff /> : <Video />}</button>}
                <button onClick={() => endCall('ended')} className="w-16 h-16 rounded-full bg-danger flex items-center justify-center"><PhoneOff /></button>
            </footer>}
        </div>
    );
}
