'use client';

import { useEffect, useState } from 'react';

/**
 * What the member is actually running.
 *
 * Read from the shell rather than written here: the APK appends
 * " GSApp/<versionCode>" to the WebView user agent on startup
 * (MainActivity#announceShellVersion), so this reports the build that is
 * installed on the phone, not the version this file was written against. A
 * hardcoded string would have been wrong the first time the two drifted, which
 * is the whole problem the marker exists to solve.
 *
 * In a browser there is no shell, so there is no version to show and the line
 * says where it is running instead of inventing a number.
 */
function installedShellVersion() {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return null;
    const match = /GSApp\/(\d+)/.exec(navigator.userAgent || '');
    if (match) return Number(match[1]);
    // Capacitor with no marker: an older shell that predates it. Known to be
    // the app, unknown which build — said plainly rather than guessed.
    return window.Capacitor ? 0 : null;
}

export default function AppVersionFooter() {
    // Resolved after mount: the user agent is not available during the server
    // render, and rendering a different string on each side is a hydration
    // mismatch.
    const [shell, setShell] = useState(undefined);
    const [current, setCurrent] = useState(null);

    useEffect(() => {
        setShell(installedShellVersion());
        let alive = true;
        fetch('/api/app-version')
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => { if (alive && data) setCurrent(data); })
            .catch(() => { /* the line below just omits the name */ });
        return () => { alive = false; };
    }, []);

    if (shell === undefined) return null;

    let text;
    if (shell === null) text = 'Genuine Sugar Mummies on the web';
    else if (shell === 0) text = 'Genuine Sugar Mummies app';
    else {
        const name = Number(current?.versionCode) === shell ? current?.versionName : '';
        text = name
            ? `Genuine Sugar Mummies ${name} (build ${shell})`
            : `Genuine Sugar Mummies build ${shell}`;
    }

    return (
        <p className="pt-2 text-center type-caption text-text-muted">{text}</p>
    );
}
