'use client';

import { useState } from 'react';
import { Camera, LocateFixed, MapPin, Mic, Bell, Settings, X } from '@/components/icons';
import {
    PERMISSIONS, markDismissed, requestLocation, requestMedia, requestNotifications,
} from '@/lib/permissions';

const ICONS = { location: MapPin, microphone: Mic, camera: Camera, notifications: Bell };

/**
 * The rationale shown before the OS dialog.
 *
 * The app previously went straight to the browser API, so the member saw a bare
 * system prompt from an app that had not said why it wanted their location or
 * camera. Denials from that prompt are sticky — the browser stops asking — so a
 * single reflexive "Block" permanently broke Nearby, calls and Go Live with no
 * route back except the OS settings screen.
 *
 * Declining here costs nothing, because the real permission has not been
 * requested yet.
 *
 * For location it also offers the accuracy choice rather than deciding for the
 * member. Precise engages GPS: better distances, slower, more battery.
 * Approximate is town-level and enough for "who is in Nakuru". Android 12+ shows
 * its own Precise/Approximate toggle, so an app that silently demands high
 * accuracy is asking for more than it needs and being refused for it.
 */
export default function PermissionSheet({ permission, onResolved, onClose }) {
    const [busy, setBusy] = useState(false);
    const [denied, setDenied] = useState(false);

    const spec = PERMISSIONS[permission];
    if (!spec) return null;
    const Icon = ICONS[permission] || MapPin;

    async function grant(options = {}) {
        setBusy(true);
        try {
            let result;
            if (permission === 'location') result = await requestLocation(options);
            else if (permission === 'microphone') result = await requestMedia({ audio: true, video: false });
            else if (permission === 'camera') result = await requestMedia({ audio: true, video: true });
            else result = await requestNotifications();

            if (result.ok) { onResolved?.(result); return; }
            // A denial is worth showing in place — closing the sheet would leave
            // the member with a feature that silently does nothing.
            if (result.reason === 'denied') { setDenied(true); return; }
            onResolved?.(result);
        } finally {
            setBusy(false);
        }
    }

    function dismiss() {
        markDismissed(permission);
        onClose?.();
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 px-4 pb-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="perm-title">
            <div className="w-full max-w-sm overflow-hidden rounded-3xl" style={{ background: 'var(--color-bg-card)', boxShadow: 'var(--shadow-lg)' }}>
                <div className="flex items-start gap-3 p-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl tint-primary">
                        <Icon size={20} className="text-primary" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 id="perm-title" className="type-title text-text-primary">{spec.title}</h2>
                        <p className="mt-1 type-caption text-text-secondary">{denied ? spec.deniedHelp : spec.why}</p>
                    </div>
                    <button type="button" onClick={dismiss} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted">
                        <X size={16} />
                    </button>
                </div>

                {denied ? (
                    <div className="space-y-2 px-5 pb-5">
                        <p className="flex items-start gap-2 rounded-xl p-3 type-caption tint-warning text-warning">
                            <Settings size={14} className="mt-0.5 shrink-0" />
                            This has to be changed in your device settings — the app cannot re-ask once it is blocked.
                        </p>
                        <button type="button" onClick={onClose} className="min-h-[44px] w-full rounded-xl type-body-strong text-white gradient-primary">
                            I have changed it
                        </button>
                    </div>
                ) : permission === 'location' ? (
                    <div className="space-y-2 px-5 pb-5">
                        {/*
                          Two grants, not one. Approximate is offered first and
                          described honestly, because for "who is near me" it is
                          genuinely enough — and a member who is uneasy about
                          precise tracking will otherwise refuse both.
                        */}
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => grant({ precise: false })}
                            className="flex min-h-[56px] w-full items-start gap-3 rounded-xl p-3 text-left disabled:opacity-60"
                            style={{ background: 'var(--color-surface)' }}
                        >
                            <MapPin size={17} className="mt-0.5 shrink-0 text-primary" />
                            <span className="min-w-0">
                                <span className="block type-body-strong text-text-primary">Approximate area</span>
                                <span className="block type-caption text-text-muted">Your town only. Faster, and uses less battery.</span>
                            </span>
                        </button>

                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => grant({ precise: true })}
                            className="flex min-h-[56px] w-full items-start gap-3 rounded-xl p-3 text-left text-white disabled:opacity-60 gradient-primary"
                        >
                            <LocateFixed size={17} className="mt-0.5 shrink-0" />
                            <span className="min-w-0">
                                <span className="block type-body-strong">Precise location</span>
                                <span className="block type-caption opacity-85">Accurate distances to each member. Uses GPS.</span>
                            </span>
                        </button>

                        <button type="button" onClick={dismiss} disabled={busy} className="min-h-[44px] w-full rounded-xl type-caption font-semibold text-text-muted">
                            Not now
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2 px-5 pb-5">
                        <button type="button" disabled={busy} onClick={() => grant()} className="min-h-[44px] w-full rounded-xl type-body-strong text-white gradient-primary disabled:opacity-60">
                            {busy ? 'Waiting for your device…' : 'Allow'}
                        </button>
                        <button type="button" onClick={dismiss} disabled={busy} className="min-h-[44px] w-full rounded-xl type-caption font-semibold text-text-muted">
                            Not now
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
