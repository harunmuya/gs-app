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

/**
 * Which shell this is running in, if any.
 *
 * Returns a version number, or 0 for a shell that predates the version marker,
 * or null when this is not the app at all.
 *
 * The marker was only added in version 4, so every shell already on a phone
 * reports nothing. Those are the ones that most need to hear about the update,
 * so an absent marker cannot simply mean "say nothing" or the feature would
 * reach only the people who did not need it.
 *
 * `window.Capacitor` is the discriminator rather than sniffing the user agent
 * for a WebView. Facebook and Instagram open links in a WebView too, and
 * telling somebody browsing inside Instagram to update an app they have not
 * installed would be nonsense.
 */
function installedShellVersion() {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return null;

    const match = /GSApp\/(\d+)/.exec(navigator.userAgent || '');
    if (match) return Number(match[1]);

    return window.Capacitor ? 0 : null;
}

const DISMISS_KEY = 'gs_update_notice_dismissed_for';

export default function AppUpdateNotice() {
    const [update, setUpdate] = useState(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const installed = installedShellVersion();
        // null means a browser, where there is no shell to update. 0 means an
        // older shell that cannot report itself, which still needs telling, so
        // this tests for null rather than falsiness.
        if (installed === null) return undefined;

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
                            {update.installed ? `You have version ${update.installed}. ` : ''}Version {update.versionCode} is out.
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

                {/*
                  Uninstall first, said as a step rather than as a warning.

                  Android refuses to install over an app of the same name signed
                  with a different key, and words it as "package conflicts with
                  an existing package". Nothing in that phrase suggests what to
                  do, and the two obvious readings, a corrupt download or a full
                  phone, are both wrong. Everybody on the current build hits it.

                  Burying that in small print under the button means most people
                  meet the error first and give up. It is the first step, in
                  order, with the reassurance attached to the step that needs it:
                  uninstalling looks destructive, and the reason it is not is
                  that accounts live on the server.
                */}
                <ol className="space-y-2.5 px-4 pb-1">
                    <li className="flex gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full tint-primary type-micro font-bold text-primary">1</span>
                        <span className="min-w-0 type-caption text-text-secondary">
                            <strong className="text-text-primary">Uninstall the app you have now.</strong> Hold its icon
                            and choose Uninstall. Nothing is lost. Your account, messages and photos are on our
                            servers, not on the phone.
                        </span>
                    </li>
                    <li className="flex gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full tint-primary type-micro font-bold text-primary">2</span>
                        <span className="min-w-0 type-caption text-text-secondary">
                            <strong className="text-text-primary">Tap the button below</strong> and open the file when
                            it finishes downloading.
                        </span>
                    </li>
                    {/*
                      Play Protect, named before it appears.

                      It warns about every app installed outside the Play Store,
                      whoever made it, because it has no listing to check against.
                      The wording is alarming by design and it is the commonest
                      point at which somebody abandons a sideloaded install: they
                      are told the app is unsafe by their own phone, moments after
                      being told by us that it is fine.

                      Saying it will happen, before it happens, is the difference.
                      A warning you were expecting reads as a formality; the same
                      warning unannounced reads as being caught out.
                    */}
                    <li className="flex gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full tint-primary type-micro font-bold text-primary">3</span>
                        <span className="min-w-0 type-caption text-text-secondary">
                            <strong className="text-text-primary">Google Play Protect will warn you.</strong> It does
                            that for every app not installed from the Play Store. Choose More details, then Install
                            anyway.
                        </span>
                    </li>
                    <li className="flex gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full tint-primary type-micro font-bold text-primary">4</span>
                        <span className="min-w-0 type-caption text-text-secondary">
                            <strong className="text-text-primary">Sign in again</strong> with the same email and
                            password. Everything is where you left it.
                        </span>
                    </li>
                </ol>

                <div className="space-y-2 p-4">
                    {/* rel and target matter here: the shell hands an
                        off-host link to the system browser, which is the only
                        thing in the picture that can download an APK. */}
                    <a
                        href={update.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl type-body-strong text-white gradient-primary"
                    >
                        Download the new app <ArrowRight size={16} />
                    </a>
                    <p className="type-micro text-text-muted">
                        If Android says the package conflicts with an existing one, the old app is still there.
                        Uninstall it and open this again.
                    </p>
                </div>
            </div>
        </div>
    );
}
