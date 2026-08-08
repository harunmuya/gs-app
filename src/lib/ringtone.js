'use client';

/**
 * A ringtone synthesised with WebAudio.
 *
 * An incoming call that only appears on screen is a call the member misses if
 * the phone is in a pocket. This is generated rather than shipped as an audio
 * file so there is no binary asset to host, no extra request, and nothing that
 * can 404 at the moment it is needed.
 *
 * The pattern is the standard two-tone cadence: 400ms of tone, 200ms gap, 400ms
 * of tone, then two seconds of silence before repeating.
 */

let context = null;
let stopTimer = null;
let repeatTimer = null;
let active = false;

function audioContext() {
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!context || context.state === 'closed') context = new Ctor();
    return context;
}

function burst(ctx, startAt, duration) {
    // Two detuned sine tones read as a phone ring; a single tone reads as an
    // alarm. Gain is ramped rather than switched to avoid the click a hard
    // start and stop produces.
    [440, 480].forEach((frequency) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0, startAt);
        gain.gain.linearRampToValueAtTime(0.14, startAt + 0.03);
        gain.gain.setValueAtTime(0.14, startAt + duration - 0.04);
        gain.gain.linearRampToValueAtTime(0, startAt + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start(startAt);
        osc.stop(startAt + duration);
    });
}

/**
 * Start ringing until stopRingtone() is called or `maxMs` elapses.
 *
 * Returns false when the browser will not allow audio yet — autoplay policy
 * blocks sound until the member has interacted with the page, and there is no
 * way around that. The visual call sheet is the fallback, which is why it is
 * never gated on this succeeding.
 */
export function startRingtone({ maxMs = 45000 } = {}) {
    if (active) return true;
    const ctx = audioContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (ctx.state === 'suspended') return false;

    active = true;
    const cycle = () => {
        if (!active) return;
        const now = ctx.currentTime;
        burst(ctx, now, 0.4);
        burst(ctx, now + 0.6, 0.4);
    };
    cycle();
    repeatTimer = window.setInterval(cycle, 3000);
    stopTimer = window.setTimeout(stopRingtone, maxMs);
    return true;
}

export function stopRingtone() {
    active = false;
    if (repeatTimer) { window.clearInterval(repeatTimer); repeatTimer = null; }
    if (stopTimer) { window.clearTimeout(stopTimer); stopTimer = null; }
}

export function isRinging() {
    return active;
}
