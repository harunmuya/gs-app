'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Radio, X } from '@/components/icons';

/**
 * Tell a member when the app around the website is out of date.
 *
 * The site loads remotely, so every web fix reaches installed users on their
 * next launch without them doing anything. The native shell does not work that
 * way. Android compiles permissions into the APK, so a change there needs an
 * install, and no amount of web deployment substitutes for it.
 *
 * That gap was invisible. Somebody could be running today's web build inside
 * the first APK, wondering why the camera never turns on, with an app that
 * looked completely up to date. Version 1 cannot reach the camera, the
 * microphone or location at all, so calls, going live and nearby matches are
 * broken on it and nothing said so.
 *
 * This only ever appears inside the Android app. In a browser there is no shell
 * to update and the whole question is meaningless, so it renders nothing.
 */

/** The shell writes `GSApp/<versionCode>` onto the user agent. */
function installedShellVersion() {
    if (typeof navigator === 'undefined') return null;
    const match = /GSApp\/(\d+)/.exec(navigator.userAgent || '');
    return match ? Number(match[1]) : null;
}

const DISMISS_KEY = 'gs_update_notice_dismissed_for';

export default function AppUpdateNotice() {
    const [update, setUpdate] = useState(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const installed = installedShellVersion();
        // No marker means a browser, or a shell too old to report itself. Either
        // way there is nothing useful to say, so say nothing.
        if (!installed) return undefined;

        let alive = true;
        (async () => {
            try {
                const res = await fetch('/api/app-version', { cache: 'no-store' });
                const data = await res.json().catch(() => ({}));
                const latest = data?.android;
                if (!alive || !latest?.versionCode) return;
                if (Number(latest.versionCode) <= installed) return;

                /*
                  A dismissal is remembered per version, not forever. Somebody
                  who says not now should not be asked again for the same
                  release, and should be asked again for the next one.
                */
                try {
                    if (localStorage.getItem(DISMISS_KEY) === String(latest.versionCode) && !latest.required) {
                        return;
                    }
                } catch { /* storage unavailable, so ask */ }

                setUpdate({ ...latest, installed });
            } catch { /* offline; this is not worth an error */ }
        })();

        return () => { alive = false; };
    }, []);

    if (!update || dismissed) return null;

    function notNow() {
        try { localStorage.setItem(DISMISS_KEY, String(update.versionCode)); } catch { /* fine */ }
        setDismissed(true);
    }

    return (
        <div className="fixed inset-x-0 bottom-0 z-[95] p-4 sm:flex sm:justify-center">
            <div
                className="w-full max-w-md overflow-hidden rounded-3xl shadow-2xl"
                style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}
                role="dialog"
                aria-live="polite"
                aria-label="App update available"
            >
                <div className="flex items-start gap-3 p-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl tint-primary">
                        <Radio size={20} className="text-primary" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="type-title text-text-primary">A newer app is ready</h2>
                        <p className="mt-0.5 type-caption text-text-muted">
                            You have version {update.installed}. Version {update.versionCode} is out.
                        </p>
                    </div>
                    {/* A required update still closes. Trapping somebody in a
                        dialog they cannot leave is how people uninstall. */}
                    <button
                        type="button"
                        onClick={notNow}
                        aria-label="Not now"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-muted"
                    >
                        <X size={18} />
                    </button>
                </div>

                {Array.isArray(update.notes) && update.notes.length > 0 && (
                    <ul className="space-y-1.5 px-4 pb-1">
                        {update.notes.map((note) => (
                            <li key={note} className="flex gap-2 type-caption text-text-secondary">
                                <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                                <span>{note}</span>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="space-y-2 p-4">
                    <a
                        href={update.url}
                        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl type-body-strong text-white gradient-primary"
                    >
                        Download the update <ArrowRight size={16} />
                    </a>
                    <p className="type-micro text-text-muted">
                        It installs over the app you already have. Your account, messages and photos stay where
                        they are, and you do not sign in again.
                    </p>
                </div>
            </div>
        </div>
    );
}
