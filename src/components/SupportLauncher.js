'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Headphones, X } from '@/components/icons';
import SupportContact from '@/components/SupportContact';

/**
 * Support, reachable from every signed-in screen.
 *
 * The channels were only ever printed at the bottom of the policy pages, which
 * are the pages nobody opens. A member stuck on a payment, a verification or a
 * profile they think is fake was on some other screen entirely, with no way to
 * reach anyone from where they stood. That is the moment support has to exist.
 *
 * It mounts once in the shell rather than being pasted into twenty pages, so
 * the handle stays in one file and no screen can forget it.
 */

/*
  Screens this stays off.

  A call and a live room are full screen and already carry their own controls
  near the thumb. A floating button there would sit over the video and compete
  with End Call, which is the one control that must never be missed.
*/
const IMMERSIVE = [/^\/calls\//, /^\/live\/[^/]+$/];

export default function SupportLauncher() {
    const pathname = usePathname() || '';
    const [open, setOpen] = useState(false);

    // Close on route change, so it never follows the member to the next screen.
    useEffect(() => { setOpen(false); }, [pathname]);

    // Escape closes it, the same as every other sheet in the app.
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    if (IMMERSIVE.some((pattern) => pattern.test(pathname))) return null;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Contact support"
                className="fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-lg"
                style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)' }}
            >
                <Headphones size={20} className="text-primary" />
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
                    {/* The backdrop closes it. A sheet you can only leave by
                        finding the small X is a sheet people feel trapped in. */}
                    <button
                        type="button"
                        aria-label="Close support"
                        onClick={() => setOpen(false)}
                        className="absolute inset-0 cursor-default"
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Contact support"
                        className="relative w-full max-w-md overflow-auto rounded-3xl"
                        style={{ maxHeight: '85dvh' }}
                    >
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            aria-label="Close support"
                            className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full"
                            style={{ background: 'var(--color-surface)' }}
                        >
                            <X size={18} className="text-text-secondary" />
                        </button>
                        {/* SupportContact brings its own card surface, so the
                            dialog stays transparent rather than stacking two. */}
                        <SupportContact title="Talk to Admin Mary G" className="pr-16" />
                    </div>
                </div>
            )}
        </>
    );
}
